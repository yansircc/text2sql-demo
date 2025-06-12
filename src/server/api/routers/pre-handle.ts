import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { embedText } from "@/lib/embed-text";
import { qdrantService } from "@/lib/qdrant/service";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * Pre-Handle Router
 *
 * 职责：快速预处理用户查询，决定处理路径
 *
 * 主要功能：
 * 1. 判断查询的可行性（数据库是否有相关数据）
 * 2. 判断查询是否清晰（是否需要补充信息）
 * 3. 识别是否需要语义搜索
 * 4. 分析涉及的表（不分析字段）
 * 5. 基于规则决定处理方式
 *
 * 处理流程：
 * - 不可行 → 返回无法处理的原因
 * - 清晰度不足 → 返回需要补充的信息
 * - 需要语义搜索 → 执行语义搜索
 * - 超过3张表 → 异步处理
 * - 其他 → 传递表信息给 pre-sql
 *
 * 输出：
 * - 预选的表列表（传给 pre-sql 以减少上下文）
 * - 处理决策和相关信息
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

// 搜索需求 Schema
const SearchRequirement = z.object({
	searchType: z
		.enum(["database", "semantic", "hybrid"])
		.describe(
			"搜索类型：database=纯数据库查询，semantic=纯语义搜索，hybrid=混合查询",
		),

	// 数据库查询相关字段（当 searchType 为 "database" 或 "hybrid" 时可选）
	databaseQuery: z
		.object({
			tables: z.array(z.string()).optional().describe("涉及的表名列表"),
		})
		.optional()
		.describe("数据库查询配置，当搜索类型为 database 或 hybrid 时使用"),

	// 语义搜索相关字段（当 searchType 为 "semantic" 或 "hybrid" 时可选）
	semanticQuery: z
		.object({
			queries: z
				.array(
					z.object({
						table: z.string().describe("需要进行语义搜索的表名"),
						fields: z
							.array(z.string())
							.optional()
							.describe("需要搜索的字段列表，可为空表示在所有相关字段中搜索"),
						searchText: z.string().describe("搜索关键词或查询语句"),
					}),
				)
				.optional()
				.describe("语义搜索查询列表"),
		})
		.optional()
		.describe("语义搜索配置，当搜索类型为 semantic 或 hybrid 时使用"),
});

// 预处理结果 Schema
export const PreHandleResultSchema = z.object({
	// 查询ID
	queryId: z.string().describe("查询的唯一标识符"),

	// 原始查询
	originalQuery: z.string().describe("用户的原始查询"),

	// 可行性分析
	feasibility: FeasibilityAnalysis,

	// 清晰度评估
	clarity: ClarityAssessment,

	// 搜索需求
	searchRequirement: SearchRequirement,
});

// AI 分析结果（内部使用）
const AIAnalysisSchema = PreHandleResultSchema.omit({
	queryId: true,
	originalQuery: true,
});

// 最终的预处理结果（包含决策）
export interface PreHandleResult extends z.infer<typeof PreHandleResultSchema> {
	decision: {
		action:
			| "request_clarification"
			| "perform_semantic_search"
			| "proceed_sync"
			| "proceed_async"
			| "not_feasible";
		message: string;
		details?: {
			clarificationNeeded?: string[];
			asyncReason?: string;
			semanticSearchText?: string;
			notFeasibleReason?: string;
			suggestedAlternatives?: string[];
		};
	};
}

export type PreHandleAction = PreHandleResult["decision"]["action"];

// 执行语义搜索函数
async function performSemanticSearch(
	queries: Array<{
		table: string;
		fields?: string[];
		searchText: string;
	}>,
): Promise<{
	success: boolean;
	results: Array<{
		table: string;
		searchText: string;
		matches: Array<{
			companyId: number;
			name?: string;
			score: number;
			matchedField: string;
			content: string;
		}>;
	}>;
	summary: string;
}> {
	console.log(`[语义搜索] 开始搜索，共 ${queries.length} 个查询`);

	const searchResults = [];
	const collectionName = env.QDRANT_DEFAULT_COLLECTION + "_optimized";

	try {
		for (const query of queries) {
			console.log(
				`[语义搜索] 处理查询: ${query.searchText} (表: ${query.table})`,
			);

			// 只处理 companies 表的语义搜索
			if (query.table !== "text2sql_companies") {
				console.log(`[语义搜索] 跳过非支持的表: ${query.table}`);
				continue;
			}

			// 生成搜索向量
			const searchVector = await embedText(query.searchText);
			if (!searchVector) {
				console.log(`[语义搜索] 无法生成搜索向量: ${query.searchText}`);
				continue;
			}

			const tableResults = {
				table: query.table,
				searchText: query.searchText,
				matches: [] as Array<{
					companyId: number;
					name?: string;
					score: number;
					matchedField: string;
					content: string;
				}>,
			};

			// 确定要搜索的向量字段 - 严格按照 AI 指定的字段
			let vectorFields: string[];

			if (query.fields?.length) {
				// AI 指定了具体字段，只搜索指定的向量化字段
				vectorFields = query.fields;
			} else {
				// AI 没有指定字段，根据查询内容智能选择
				console.log(
					"[语义搜索] AI 未指定具体字段，将根据查询内容智能选择向量字段",
				);
				vectorFields = query.fields || []; // 默认搜索所有向量字段
			}

			if (vectorFields.length === 0) {
				console.log(
					`[语义搜索] 警告：在表 ${query.table} 中没有找到可搜索的向量字段`,
				);
				continue;
			}

			console.log(`[语义搜索] 将在以下字段中搜索: ${vectorFields.join(", ")}`);

			// 映射字段名到向量名
			const fieldToVectorName = {
				remark: "remark",
				requiredProducts19978277361: "requiredProducts",
			};

			// 对每个向量字段进行搜索
			for (const field of vectorFields) {
				const vectorName =
					fieldToVectorName[field as keyof typeof fieldToVectorName];
				if (!vectorName) continue;

				console.log(`[语义搜索] 在 ${vectorName} 向量中搜索...`);

				try {
					const results = await qdrantService.searchNamedVector(
						collectionName,
						{
							vectorName: vectorName,
							vector: searchVector,
							limit: 5,
							withPayload: true,
							withVectors: false,
						},
					);

					console.log(
						`[语义搜索] ${vectorName} 搜索找到 ${results.length} 个结果`,
					);

					// 处理搜索结果
					for (const result of results) {
						if (result.score && result.score > 0.1) {
							// 只保留相似度较高的结果
							const payload = result.payload as any;
							tableResults.matches.push({
								companyId: payload.companyId,
								name: payload.name,
								score: result.score,
								matchedField: field,
								content: payload[field] || "",
							});
						}
					}
				} catch (searchError) {
					console.error(`[语义搜索] ${vectorName} 搜索失败:`, searchError);
				}
			}

			// 按分数排序并去重
			tableResults.matches = tableResults.matches
				.sort((a, b) => b.score - a.score)
				.filter(
					(match, index, arr) =>
						arr.findIndex((m) => m.companyId === match.companyId) === index,
				)
				.slice(0, 10); // 限制最多10个结果

			searchResults.push(tableResults);
		}

		// 生成搜索摘要
		const totalMatches = searchResults.reduce(
			(sum, result) => sum + result.matches.length,
			0,
		);
		const summary =
			totalMatches > 0
				? `语义搜索完成，共找到 ${totalMatches} 个相关结果`
				: "语义搜索完成，但未找到高相关度的匹配结果";

		console.log(`[语义搜索] ${summary}`);

		return {
			success: true,
			results: searchResults,
			summary,
		};
	} catch (error) {
		console.error("[语义搜索] 搜索过程出错:", error);
		return {
			success: false,
			results: [],
			summary: "语义搜索过程中发生错误",
		};
	}
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
				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const currentTime = new Date().toISOString();
				const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

				const systemPrompt = `你是一个智能查询预处理分析师。你的任务是快速评估用户查询，判断是否可以继续处理。

当前时间: ${currentTime}
数据库Schema: ${input.databaseSchema}
向量化数据库Schema(仅包含向量化字段): ${input.vectorizedDatabaseSchema || "无"}
上下文: ${input.context || "无"}

请按顺序快速分析用户查询：

1. **可行性分析**（最重要）：
   - 仔细检查用户查询的主要内容是否与现有数据库表相关
   - 数据库中是否有相关的表和字段可以支持这个查询？
   - 如果查询内容完全不在数据库范围内（如"希望小学成立时间"、"天气情况"、"股票价格"等），应该标记为不可行
   - 如果不可行，说明具体原因并建议替代查询方向

2. **清晰度评估**（仅在可行的情况下进行）：
   - 查询是否有明确的目标和条件？
   - 是否缺少关键信息（如时间范围、具体对象、数量限制等）？
   - 如果不清晰，具体指出缺少什么信息

3. **搜索需求分析**（仅在可行且清晰的情况下进行）：
   必须选择一种搜索类型：
   - **database**: 纯数据库查询，需要精确的SQL查询，涉及具体表和字段
   - **semantic**: 纯语义搜索，需要理解模糊匹配、同义词、相似概念
   - **hybrid**: 混合查询，既需要数据库查询也需要语义搜索
   
   根据选择的类型，可选择性填写：
   - 如果是 database/hybrid: 可以指定涉及的表名列表
   - 如果是 semantic/hybrid: **必须明确指定**在哪些表的哪些字段搜索什么关键词，不要留空
   - 其他衍生字段可以留空，AI会根据情况补充

**重要原则**：
- 首要任务是判断可行性，不要跳过这一步
- 对于明显超出数据库范围的查询，果断标记为不可行
- 快速判断，不要过度分析
- 对于边界情况，倾向于让查询继续进行
- 清晰地指出需要用户补充的具体信息
- 搜索类型必须明确选择，衍生字段可以为空`;

				const { object: aiAnalysis } = await generateObject({
					model: openai("gpt-4.1"),
					system: systemPrompt,
					prompt: `请预处理这个查询：\n\n"${input.query}"\n\n生成预处理分析报告。`,
					schema: AIAnalysisSchema,
					temperature: 0.1,
				});

				// 基于规则的决策逻辑
				const makeDecision = (analysis: z.infer<typeof AIAnalysisSchema>) => {
					// 1. 可行性检查 - 最高优先级
					if (!analysis.feasibility.isFeasible) {
						return {
							action: "not_feasible" as const,
							message: "抱歉，当前数据库无法处理您的查询。",
							details: {
								notFeasibleReason:
									analysis.feasibility.reason || "查询内容超出数据库范围",
								suggestedAlternatives:
									analysis.feasibility.suggestedAlternatives || [],
							},
						};
					}

					// 2. 信息不明确
					if (
						!analysis.clarity.isClear &&
						analysis.clarity.missingInfo.length > 0
					) {
						return {
							action: "request_clarification" as const,
							message: "您的查询需要补充一些信息才能继续处理。",
							details: {
								clarificationNeeded: analysis.clarity.missingInfo.map(
									(info) =>
										`${info.field}: ${info.description}${info.example ? ` (例如: ${info.example})` : ""}`,
								),
							},
						};
					}

					// 3. 需要语义搜索
					if (
						analysis.searchRequirement.searchType === "semantic" ||
						analysis.searchRequirement.searchType === "hybrid"
					) {
						const semanticQueries =
							analysis.searchRequirement.semanticQuery?.queries;
						const firstQuery = semanticQueries?.[0];
						return {
							action: "perform_semantic_search" as const,
							message: "正在进行语义搜索以获取更准确的结果...",
							details: {
								semanticSearchText: firstQuery?.searchText || input.query,
							},
						};
					}

					// 4. 多表联查（超过3张表）
					const tableCount =
						analysis.searchRequirement.databaseQuery?.tables?.length || 0;
					if (
						analysis.searchRequirement.searchType === "database" ||
						tableCount > 3
					) {
						return {
							action: "proceed_async" as const,
							message:
								"您的查询涉及多个数据表的复杂关联，需要较长时间处理。我们将在后台处理完成后通知您。",
							details: {
								asyncReason: `查询涉及 ${tableCount} 张表的关联，预计需要较长处理时间`,
							},
						};
					}

					// 5. 默认同步处理
					return {
						action: "proceed_sync" as const,
						message: "查询分析完成，正在生成SQL...",
					};
				};

				// 组装完整结果
				const fullResult: PreHandleResult = {
					queryId,
					originalQuery: input.query,
					...aiAnalysis,
					decision: makeDecision(aiAnalysis),
				};

				// 处理不同的决策
				if (fullResult.decision.action === "perform_semantic_search") {
					// 执行语义搜索
					const semanticQueries =
						aiAnalysis.searchRequirement.semanticQuery?.queries || [];

					// 如果没有具体的查询配置，使用原始查询作为默认
					const searchQueries =
						semanticQueries.length > 0
							? semanticQueries
							: [
									{
										table: "text2sql_companies",
										searchText: input.query,
									},
								];

					const semanticResult = await performSemanticSearch(searchQueries);

					return {
						success: true,
						result: fullResult,
						semanticSearchResult: semanticResult,
						nextStep: "将语义搜索结果作为补充信息传递给 pre-sql",
					};
				}

				if (fullResult.decision.action === "request_clarification") {
					// 需要用户补充信息，直接返回
					return {
						success: false,
						result: fullResult,
						userActionRequired: true,
						clarificationNeeded:
							fullResult.decision.details?.clarificationNeeded,
					};
				}

				if (fullResult.decision.action === "proceed_async") {
					// 异步处理
					return {
						success: true,
						result: fullResult,
						asyncProcessing: true,
						message: fullResult.decision.message,
					};
				}

				// 默认同步处理
				return {
					success: true,
					result: fullResult,
					canProceed: true,
				};
			} catch (error) {
				console.error("预处理错误:", error);
				throw new Error("查询预处理服务暂时不可用，请稍后再试");
			}
		}),

	// 获取预处理 schema 定义
	getPreHandleSchema: publicProcedure.query(() => {
		return {
			schema: PreHandleResultSchema,
			version: "1.0.0",
			description: "查询预处理分析结果的数据结构定义",
			features: [
				"查询清晰度评估",
				"语义搜索需求识别",
				"表复杂度分析",
				"智能处理决策",
			],
		};
	}),
});
