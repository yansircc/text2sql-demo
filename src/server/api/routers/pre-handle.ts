import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { embedText } from "@/lib/embed-text";
import { qdrantService } from "@/lib/qdrant/service";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * Pre-Handle Router - 2025年最佳实践版本
 *
 * 职责：智能查询预处理，基于查询特征决定最优处理路径
 *
 * 主要功能：
 * 1. 快速可行性检查（不可行直接返回）
 * 2. 清晰度评估（不清晰直接返回）
 * 3. 表数量检查（超过3张表直接返回）
 * 4. 智能搜索类型判断：
 *    - 纯SQL查询（SQLite模糊查询可以解决）
 *    - 纯向量搜索（直接返回结果）
 *    - 混合搜索（并行执行，使用RRF融合）
 *
 * 2025年最佳实践：
 * - 优先使用SQL模糊查询，仅在必要时使用向量搜索
 * - 向量搜索使用批量搜索提高效率
 * - 混合搜索使用RRF（Reciprocal Rank Fusion）融合结果
 * - 支持跨表语义搜索结果作为SQL查询的过滤条件
 */

// 查询可行性分析 Schema
const FeasibilityAnalysis = z.object({
	isFeasible: z.boolean().describe("查询是否可行，数据库是否有相关数据支持"),
	reason: z.string().optional().describe("如果不可行，说明具体原因"),
	suggestedAlternatives: z
		.array(z.string())
		.optional()
		.describe("如果不可行，建议的替代查询方向"),
});

// 查询清晰度评估 Schema
const ClarityAssessment = z.object({
	isClear: z.boolean().describe("查询是否清晰明确"),
	missingInfo: z
		.array(
			z.object({
				field: z.string().describe("缺失的信息字段"),
				description: z.string().describe("需要用户补充的具体说明"),
				example: z.string().optional().describe("示例说明"),
			}),
		)
		.describe("需要用户补充的信息列表"),
});

// 增强的搜索需求 Schema - 2025版本
const SearchRequirement = z.object({
	searchType: z
		.enum(["sql_only", "vector_only", "hybrid"])
		.describe(
			"搜索类型：sql_only=纯SQL查询（包含模糊搜索），vector_only=纯向量搜索，hybrid=混合搜索",
		),

	// SQL查询配置
	sqlQuery: z
		.object({
			tables: z.array(z.string()).describe("涉及的表名列表"),
			canUseFuzzySearch: z
				.boolean()
				.describe("是否可以通过SQL模糊查询（LIKE）解决"),
			fuzzySearchPatterns: z
				.array(z.string())
				.optional()
				.describe("建议的模糊搜索模式"),
		})
		.optional()
		.describe("SQL查询配置"),

	// 向量搜索配置
	vectorQuery: z
		.object({
			queries: z
				.array(
					z.object({
						table: z.string().describe("需要进行语义搜索的表名"),
						vectorFields: z.array(z.string()).describe("要搜索的向量字段列表"),
						searchText: z.string().describe("搜索关键词或查询语句"),
						expectedResultCount: z
							.number()
							.default(10)
							.describe("期望返回的结果数量"),
					}),
				)
				.describe("向量搜索查询列表"),
			requiresReranking: z
				.boolean()
				.default(false)
				.describe("是否需要使用交叉编码器重排序"),
		})
		.optional()
		.describe("向量搜索配置"),

	// 混合搜索策略
	hybridStrategy: z
		.object({
			fusionMethod: z
				.enum(["rrf", "weighted", "keyword_first"])
				.default("rrf")
				.describe("融合方法：RRF、加权或关键词优先"),
			weightVector: z.number().default(0.5).describe("向量搜索权重"),
			weightSQL: z.number().default(0.5).describe("SQL搜索权重"),
		})
		.optional()
		.describe("混合搜索策略配置"),
});

// 预处理结果 Schema
export const PreHandleResultSchema = z.object({
	queryId: z.string().describe("查询的唯一标识符"),
	originalQuery: z.string().describe("用户的原始查询"),
	feasibility: FeasibilityAnalysis,
	clarity: ClarityAssessment,
	searchRequirement: SearchRequirement,
});

// AI 分析结果（内部使用）
const AIAnalysisSchema = PreHandleResultSchema.omit({
	queryId: true,
	originalQuery: true,
});

// 向量搜索结果类型
interface VectorSearchResult {
	companyId: number;
	name?: string;
	score: number;
	matchedField: string;
	content: string;
	rank?: number;
}

// RRF融合函数
function reciprocalRankFusion(
	vectorResults: VectorSearchResult[],
	sqlResultIds: number[],
	k = 60,
	weightVector = 0.5,
	weightSQL = 0.5,
): Array<{ id: number; score: number; source: "vector" | "sql" | "both" }> {
	const fusedScores = new Map<number, { score: number; source: Set<string> }>();

	// 处理向量搜索结果
	vectorResults.forEach((result, index) => {
		const rrfScore = 1 / (k + index + 1);
		const existing = fusedScores.get(result.companyId);
		if (existing) {
			existing.score += rrfScore * weightVector;
			existing.source.add("vector");
		} else {
			fusedScores.set(result.companyId, {
				score: rrfScore * weightVector,
				source: new Set(["vector"]),
			});
		}
	});

	// 处理SQL搜索结果
	sqlResultIds.forEach((id, index) => {
		const rrfScore = 1 / (k + index + 1);
		const existing = fusedScores.get(id);
		if (existing) {
			existing.score += rrfScore * weightSQL;
			existing.source.add("sql");
		} else {
			fusedScores.set(id, {
				score: rrfScore * weightSQL,
				source: new Set(["sql"]),
			});
		}
	});

	// 转换为数组并排序
	return Array.from(fusedScores.entries())
		.map(([id, data]) => ({
			id,
			score: data.score,
			source:
				data.source.size === 2
					? ("both" as const)
					: (Array.from(data.source)[0] as "vector" | "sql"),
		}))
		.sort((a, b) => b.score - a.score);
}

// 执行向量搜索函数 - 2025版本
async function performVectorSearch(
	queries: Array<{
		table: string;
		vectorFields: string[];
		searchText: string;
		expectedResultCount?: number;
	}>,
): Promise<{
	success: boolean;
	results: VectorSearchResult[];
	summary: string;
	searchTime: number;
}> {
	const startTime = Date.now();
	console.log(`[向量搜索] 开始搜索，共 ${queries.length} 个查询`);

	const allResults: VectorSearchResult[] = [];
	const baseCollectionName = env.QDRANT_DEFAULT_COLLECTION;

	try {
		// 批量生成搜索向量
		const searchVectors = await Promise.all(
			queries.map((q) => embedText(q.searchText)),
		);

		// 并行执行所有向量搜索
		const searchPromises = queries.flatMap((query, queryIndex) => {
			const searchVector = searchVectors[queryIndex];
			if (!searchVector) return [];

			// 根据表名生成集合名称（移除 text2sql_ 前缀）
			const tableName = query.table.replace("text2sql_", "");
			const collectionName = `${baseCollectionName}-${tableName}`;

			console.log(`[向量搜索] 使用集合: ${collectionName}`);

			return query.vectorFields.map(async (field) => {
				console.log(
					`[向量搜索] 搜索 ${collectionName}.${field} 字段: "${query.searchText}"`,
				);

				try {
					// 检查集合是否存在
					const exists = await qdrantService.collectionExists(collectionName);
					if (!exists) {
						console.warn(`[向量搜索] 集合 ${collectionName} 不存在，跳过`);
						return [];
					}

					// 获取集合信息，检查向量字段是否存在
					const collectionInfo = await qdrantService
						.getClient()
						.getCollection(collectionName);
					const vectorFields = Object.keys(
						collectionInfo.config.params.vectors || {},
					);

					if (!vectorFields.includes(field)) {
						console.warn(
							`[向量搜索] 字段 ${field} 在集合 ${collectionName} 中不存在，跳过`,
						);
						return [];
					}

					const results = await qdrantService.search(collectionName, {
						vectorName: field,
						vector: searchVector,
						limit: query.expectedResultCount || 10,
						withPayload: true,
						withVectors: false,
						hnswEf: 128,
					});

					return results.map((result, idx) => ({
						companyId: (result.payload?.companyId as number) || 0,
						name: result.payload?.name as string,
						score: result.score || 0,
						matchedField: field,
						content: (result.payload?.[field] as string) || "",
						rank: idx + 1,
					}));
				} catch (error) {
					console.error(`[向量搜索] ${field} 搜索失败:`, error);
					return [];
				}
			});
		});

		// 等待所有搜索完成
		const searchResults = await Promise.all(searchPromises.flat());

		// 合并结果并去重
		const mergedResults = searchResults.flat();
		const uniqueResults = new Map<number, VectorSearchResult>();

		mergedResults.forEach((result) => {
			const existing = uniqueResults.get(result.companyId);
			if (!existing || result.score > existing.score) {
				uniqueResults.set(result.companyId, result);
			}
		});

		// 按分数排序
		const sortedResults = Array.from(uniqueResults.values()).sort(
			(a, b) => b.score - a.score,
		);

		const searchTime = Date.now() - startTime;
		console.log(
			`[向量搜索] 完成，找到 ${sortedResults.length} 个结果，耗时 ${searchTime}ms`,
		);

		return {
			success: true,
			results: sortedResults,
			summary: `向量搜索完成，找到 ${sortedResults.length} 个相关结果`,
			searchTime,
		};
	} catch (error) {
		console.error("[向量搜索] 搜索过程出错:", error);
		return {
			success: false,
			results: [],
			summary: "向量搜索过程中发生错误",
			searchTime: Date.now() - startTime,
		};
	}
}

// 最终的预处理结果（包含决策）
export interface PreHandleResult extends z.infer<typeof PreHandleResultSchema> {
	decision: {
		action:
			| "not_feasible"
			| "request_clarification"
			| "too_many_tables"
			| "sql_only"
			| "vector_only"
			| "hybrid_search";
		message: string;
		details?: any;
	};
}

export const preHandleRouter = createTRPCRouter({
	// 预处理查询
	handleQuery: publicProcedure
		.input(
			z.object({
				query: z.string().min(1, "查询不能为空").describe("用户的查询"),
				databaseSchema: z.string().describe("数据库schema的JSON字符串"),
				vectorizedDatabaseSchema: z
					.string()
					.optional()
					.describe("向量化数据库schema的JSON字符串"),
				context: z.string().optional().describe("额外的上下文信息"),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				console.log("[PreHandle] 开始处理查询:", input.query);

				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const currentTime = new Date().toISOString();
				const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

				const systemPrompt = `你是一个智能查询预处理分析师。你的任务是快速评估用户查询，并决定最优的处理路径。

当前时间: ${currentTime}
数据库Schema: ${input.databaseSchema}
向量化数据库Schema(仅包含向量化字段): ${input.vectorizedDatabaseSchema || "无"}
上下文: ${input.context || "无"}

**2025年最佳实践原则**：
1. 优先使用SQL查询（包括模糊搜索LIKE），只在真正需要语义理解时使用向量搜索
2. 如果查询包含精确的关键词或名称，优先SQL模糊搜索
3. 如果查询需要理解同义词、相似概念或模糊匹配，才使用向量搜索
4. 混合搜索适用于既需要精确匹配又需要语义理解的场景

请按顺序分析：

1. **可行性分析**（最重要）：
   - 查询是否在数据库范围内？
   - 如果不可行，立即返回原因

2. **清晰度评估**：
   - 查询是否有明确的目标？
   - 缺少什么关键信息？

3. **表数量检查**：
   - 如果涉及超过3张表，标记为过于复杂

4. **搜索类型判断**（核心）：
   - **sql_only**: 可以通过SQL（包括LIKE模糊查询）解决
     示例：查找特定公司名称、包含特定关键词的产品等
   - **vector_only**: 必须使用向量搜索才能理解查询意图
     示例：查找"类似产品"、"相关技术"、同义词匹配等
   - **hybrid**: 需要两种方法结合
     示例：查找"提供云计算服务的大型企业"（大型企业用SQL，云计算用向量）

对于向量搜索，必须明确指定：
- 搜索哪个表的哪些向量字段
- 使用什么搜索文本
- 期望返回多少结果`;

				const { object: aiAnalysis } = await generateObject({
					model: openai("gpt-4.1"),
					system: systemPrompt,
					prompt: `请预处理这个查询：\n\n"${input.query}"\n\n生成预处理分析报告。`,
					schema: AIAnalysisSchema,
					temperature: 0.1,
				});

				console.log("[PreHandle] AI分析完成:", {
					searchType: aiAnalysis.searchRequirement.searchType,
					isFeasible: aiAnalysis.feasibility.isFeasible,
					isClear: aiAnalysis.clarity.isClear,
					tableCount:
						aiAnalysis.searchRequirement.sqlQuery?.tables?.length || 0,
				});

				// 组装完整结果
				const fullResult: PreHandleResult = {
					queryId,
					originalQuery: input.query,
					...aiAnalysis,
					decision: { action: "sql_only", message: "" }, // 临时占位
				};

				// 决策逻辑 - 按优先级处理
				// 1. 可行性检查
				if (!aiAnalysis.feasibility.isFeasible) {
					console.log("[PreHandle] 查询不可行:", aiAnalysis.feasibility.reason);
					fullResult.decision = {
						action: "not_feasible",
						message: "查询超出数据库范围，无法处理",
						details: {
							reason: aiAnalysis.feasibility.reason,
							alternatives: aiAnalysis.feasibility.suggestedAlternatives,
						},
					};
					return {
						success: false,
						result: fullResult,
						canProceed: false,
					};
				}

				// 2. 清晰度检查
				if (!aiAnalysis.clarity.isClear) {
					console.log(
						"[PreHandle] 查询需要澄清:",
						aiAnalysis.clarity.missingInfo.map((info) => info.field),
					);
					fullResult.decision = {
						action: "request_clarification",
						message: "查询需要更多信息",
						details: {
							missingInfo: aiAnalysis.clarity.missingInfo,
						},
					};
					return {
						success: false,
						result: fullResult,
						needsClarification: true,
					};
				}

				// 3. 表数量检查
				const tableCount =
					aiAnalysis.searchRequirement.sqlQuery?.tables?.length || 0;
				if (tableCount > 3) {
					console.log(`[PreHandle] 查询过于复杂，涉及 ${tableCount} 张表`);
					fullResult.decision = {
						action: "too_many_tables",
						message: `查询涉及 ${tableCount} 张表，过于复杂`,
						details: {
							tables: aiAnalysis.searchRequirement.sqlQuery?.tables,
							suggestion: "请简化查询或分步查询",
						},
					};
					return {
						success: false,
						result: fullResult,
						tooComplex: true,
					};
				}

				// 4. 根据搜索类型执行
				const searchType = aiAnalysis.searchRequirement.searchType;

				// 纯SQL查询
				if (searchType === "sql_only") {
					console.log("[PreHandle] 决策: 纯SQL查询", {
						canUseFuzzySearch:
							aiAnalysis.searchRequirement.sqlQuery?.canUseFuzzySearch,
						tables: aiAnalysis.searchRequirement.sqlQuery?.tables,
					});
					fullResult.decision = {
						action: "sql_only",
						message: "使用SQL查询处理",
						details: {
							canUseFuzzySearch:
								aiAnalysis.searchRequirement.sqlQuery?.canUseFuzzySearch,
							fuzzyPatterns:
								aiAnalysis.searchRequirement.sqlQuery?.fuzzySearchPatterns,
						},
					};
					return {
						success: true,
						result: fullResult,
						nextStep: "pre-sql",
					};
				}

				// 纯向量搜索 - 直接返回结果
				if (searchType === "vector_only") {
					const vectorQueries =
						aiAnalysis.searchRequirement.vectorQuery?.queries || [];

					console.log(
						`[PreHandle] 决策: 纯向量搜索，${vectorQueries.length} 个查询`,
					);

					if (vectorQueries.length === 0) {
						// 如果AI没有提供具体配置，使用默认配置
						vectorQueries.push({
							table: "text2sql_companies",
							vectorFields: ["requiredProducts19978277361", "remark"],
							searchText: input.query,
							expectedResultCount: 10,
						});
					}

					const vectorResult = await performVectorSearch(vectorQueries);

					console.log(
						`[PreHandle] 向量搜索完成: ${vectorResult.results.length} 个结果`,
					);

					fullResult.decision = {
						action: "vector_only",
						message: "向量搜索完成",
						details: {
							searchTime: vectorResult.searchTime,
							resultCount: vectorResult.results.length,
						},
					};

					return {
						success: true,
						result: fullResult,
						vectorSearchResult: vectorResult,
						complete: true, // 表示查询已完成，不需要进一步处理
					};
				}

				// 混合搜索 - 并行执行
				if (searchType === "hybrid") {
					console.log("[PreHandle] 决策: 混合搜索模式");

					// 启动向量搜索（异步）
					const vectorQueries =
						aiAnalysis.searchRequirement.vectorQuery?.queries || [];

					// 如果没有提供向量查询配置，创建默认配置
					if (vectorQueries.length === 0) {
						console.warn("[混合搜索] AI未提供向量查询配置，使用默认配置");
						vectorQueries.push({
							table: "text2sql_companies",
							vectorFields: [
								"name",
								"shortName",
								"remark",
								"mainBusiness7375678270531",
								"requiredProducts19978277361",
							],
							searchText: input.query,
							expectedResultCount: 20,
						});
					}

					const vectorSearchPromise = performVectorSearch(vectorQueries);

					// 准备SQL查询信息
					const sqlInfo = {
						tables: aiAnalysis.searchRequirement.sqlQuery?.tables || [],
						fuzzyPatterns:
							aiAnalysis.searchRequirement.sqlQuery?.fuzzySearchPatterns || [],
					};

					// 等待向量搜索结果
					const vectorResult = await vectorSearchPromise;

					console.log("[PreHandle] 混合搜索向量部分完成:", {
						vectorResultCount: vectorResult.results.length,
						topCompanyIds: vectorResult.results
							.slice(0, 5)
							.map((r) => r.companyId),
					});

					fullResult.decision = {
						action: "hybrid_search",
						message: "混合搜索模式",
						details: {
							fusionMethod:
								aiAnalysis.searchRequirement.hybridStrategy?.fusionMethod ||
								"rrf",
							vectorWeight:
								aiAnalysis.searchRequirement.hybridStrategy?.weightVector ||
								0.5,
							sqlWeight:
								aiAnalysis.searchRequirement.hybridStrategy?.weightSQL || 0.5,
							vectorResultCount: vectorResult.results.length,
							companyIds: vectorResult.results.map((r) => r.companyId),
						},
					};

					return {
						success: true,
						result: fullResult,
						hybridSearch: {
							vectorResult,
							sqlInfo,
							strategy: aiAnalysis.searchRequirement.hybridStrategy,
						},
						nextStep: "pre-sql-with-vector-context",
						// 添加向量搜索上下文，供后续步骤使用
						vectorContext: {
							hasResults: vectorResult.results.length > 0,
							companyIds: vectorResult.results.map((r) => r.companyId),
							topResults: vectorResult.results.slice(0, 5),
						},
					};
				}

				// 默认处理
				console.log("[PreHandle] 使用默认处理: SQL查询");
				fullResult.decision = {
					action: "sql_only",
					message: "默认使用SQL查询",
				};
				return {
					success: true,
					result: fullResult,
					nextStep: "pre-sql",
				};
			} catch (error) {
				console.error("[PreHandle] 预处理错误:", error);
				throw new Error("查询预处理服务暂时不可用，请稍后再试");
			}
		}),

	// 执行RRF融合
	fuseResults: publicProcedure
		.input(
			z.object({
				vectorResults: z.array(
					z.object({
						companyId: z.number(),
						name: z.string().optional(),
						score: z.number(),
						matchedField: z.string(),
						content: z.string(),
					}),
				),
				sqlResultIds: z.array(z.number()),
				k: z.number().default(60),
				weightVector: z.number().default(0.5),
				weightSQL: z.number().default(0.5),
			}),
		)
		.mutation(async ({ input }) => {
			const fusedResults = reciprocalRankFusion(
				input.vectorResults,
				input.sqlResultIds,
				input.k,
				input.weightVector,
				input.weightSQL,
			);

			return {
				success: true,
				fusedResults,
				summary: `RRF融合完成，共 ${fusedResults.length} 个结果`,
			};
		}),

	// 获取预处理 schema 定义
	getPreHandleSchema: publicProcedure.query(() => {
		return {
			schema: PreHandleResultSchema,
			version: "2.0.0-2025",
			description: "查询预处理分析结果的数据结构定义（2025最佳实践版）",
			features: [
				"智能搜索类型判断",
				"SQL模糊查询优先",
				"纯向量搜索直接返回",
				"混合搜索RRF融合",
				"并行处理优化",
			],
		};
	}),
});
