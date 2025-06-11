import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * Pre-Handle Router
 *
 * 职责：快速预处理用户查询，决定处理路径
 *
 * 主要功能：
 * 1. 判断查询是否清晰（是否需要补充信息）
 * 2. 识别是否需要语义搜索
 * 3. 分析涉及的表（不分析字段）
 * 4. 基于规则决定处理方式
 *
 * 处理流程：
 * - 清晰度不足 → 返回需要补充的信息
 * - 需要语义搜索 → 执行语义搜索
 * - 超过3张表 → 异步处理
 * - 其他 → 传递表信息给 pre-sql
 *
 * 输出：
 * - 预选的表列表（传给 pre-sql 以减少上下文）
 * - 处理决策和相关信息
 */

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

// 语义搜索需求 Schema
const SemanticSearchRequirement = z.object({
	needsSemanticSearch: z.boolean().describe("是否需要语义搜索"),
	semanticQueries: z
		.array(
			z.object({
				query: z.string().describe("需要进行语义搜索的查询部分"),
				purpose: z.string().describe("语义搜索的目的"),
				expectedResult: z
					.string()
					.describe("期望得到的结果类型，如：相似产品名、模糊匹配的客户等"),
			}),
		)
		.describe("需要进行的语义搜索列表"),
});

// 表和字段分析 Schema
const TableFieldAnalysis = z.object({
	tableCount: z.number().describe("涉及的表数量"),
	tables: z.array(z.string()).describe("涉及的表列表"),
	hasJoins: z.boolean().describe("是否需要表关联"),
});

// 预处理结果 Schema
export const PreHandleResultSchema = z.object({
	// 查询ID
	queryId: z.string().describe("查询的唯一标识符"),

	// 原始查询
	originalQuery: z.string().describe("用户的原始查询"),

	// 清晰度评估
	clarity: ClarityAssessment,

	// 语义搜索需求
	semanticSearch: SemanticSearchRequirement,

	// 表和字段分析
	tableAnalysis: TableFieldAnalysis,
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
			| "proceed_async";
		message: string;
		details?: {
			clarificationNeeded?: string[];
			asyncReason?: string;
			semanticSearchText?: string;
		};
	};
}

export type PreHandleAction = PreHandleResult["decision"]["action"];

// 模拟语义搜索函数
async function performSemanticSearch(query: string): Promise<string> {
	// 这里未来会集成实际的语义搜索
	console.log(`[语义搜索] 正在搜索: "${query}"`);

	// 模拟一些搜索结果
	const mockResults = {
		iPhone: ["iPhone 15", "iPhone 14", "iPhone 13", "Apple手机"],
		类似: ["相似", "相关", "类型相同"],
		大概: ["大约", "左右", "上下"],
	};

	// 简单的关键词匹配模拟
	for (const [key, values] of Object.entries(mockResults)) {
		if (query.toLowerCase().includes(key.toLowerCase())) {
			return `语义搜索结果：找到与"${key}"相关的内容 - ${values.join(", ")}`;
		}
	}

	return `语义搜索结果：未找到与"${query}"相关的特定内容`;
}

export const preHandleRouter = createTRPCRouter({
	// 预处理查询
	handleQuery: publicProcedure
		.input(
			z.object({
				query: z.string().min(1, "查询不能为空").describe("用户的查询"),
				databaseSchema: z.string().describe("数据库schema的JSON字符串"),
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
上下文: ${input.context || "无"}

请快速分析用户查询：

1. **清晰度评估**：
   - 查询是否有明确的目标和条件？
   - 是否缺少关键信息（如时间范围、具体对象、数量限制等）？
   - 如果不清晰，具体指出缺少什么信息

2. **语义搜索需求**：
   - 是否包含模糊匹配需求（如"类似的"、"相关的"、"大概"）？
   - 是否需要理解同义词或业务术语？
   - 如需要，明确指出哪些部分需要语义搜索

3. **表分析**：
   - 准确识别涉及的表数量
   - 列出需要的表名，并给出置信度（0-1）
   - 判断是否需要表关联（hasJoins）
   - 不需要分析具体字段，这将在下一步处理

**重要原则**：
- 快速判断，不要过度分析
- 对于边界情况，倾向于让查询继续进行
- 清晰地指出需要用户补充的具体信息
- 对于复杂查询，友好地告知用户预期等待时间`;

				const { object: aiAnalysis } = await generateObject({
					model: openai("gpt-4.1"),
					system: systemPrompt,
					prompt: `请预处理这个查询：\n\n"${input.query}"\n\n生成预处理分析报告。`,
					schema: AIAnalysisSchema,
					temperature: 0.1,
				});

				// 基于规则的决策逻辑
				const makeDecision = (analysis: z.infer<typeof AIAnalysisSchema>) => {
					// 1. 信息不明确 - 最高优先级
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

					// 2. 需要语义搜索
					if (
						analysis.semanticSearch.needsSemanticSearch &&
						analysis.semanticSearch.semanticQueries.length > 0
					) {
						const firstQuery = analysis.semanticSearch.semanticQueries[0];
						return {
							action: "perform_semantic_search" as const,
							message: "正在进行语义搜索以获取更准确的结果...",
							details: {
								semanticSearchText: firstQuery?.query || input.query,
							},
						};
					}

					// 3. 多表联查（超过3张表）
					if (analysis.tableAnalysis.tableCount > 3) {
						return {
							action: "proceed_async" as const,
							message:
								"您的查询涉及多个数据表的复杂关联，需要较长时间处理。我们将在后台处理完成后通知您。",
							details: {
								asyncReason: `查询涉及 ${analysis.tableAnalysis.tableCount} 张表的关联，预计需要较长处理时间`,
							},
						};
					}

					// 4. 默认同步处理
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
					decision: {
						action: "proceed_sync" as const,
						message: "查询分析完成，正在生成SQL...",
					},
					// decision: makeDecision(aiAnalysis),
				};

				// 处理不同的决策
				if (fullResult.decision.action === "perform_semantic_search") {
					// 执行语义搜索
					const semanticText =
						fullResult.decision.details?.semanticSearchText || input.query;
					const semanticResult = await performSemanticSearch(semanticText);

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
