import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { cacheManager } from "@/server/lib/cache-manager";

/**
 * Query Analyzer Router - CloudFlare Workflow Step 1
 *
 * 职责：纯粹的查询分析和路由决策
 * - 不执行任何搜索
 * - 不处理数据
 * - 只分析查询意图并返回路由决策
 */

// 查询分析结果
export const QueryAnalysisSchema = z.object({
	queryId: z.string().describe("查询唯一标识"),
	originalQuery: z.string().describe("原始查询"),
	timestamp: z.string().describe("分析时间戳"),

	// 可行性检查
	feasibility: z.object({
		isFeasible: z.boolean(),
		reason: z.string().optional(),
		suggestedAlternatives: z.array(z.string()).optional(),
	}),

	// 清晰度检查
	clarity: z.object({
		isClear: z.boolean(),
		missingInfo: z
			.array(
				z.object({
					field: z.string(),
					description: z.string(),
				}),
			)
			.optional(),
	}),

	// 路由决策
	routing: z.object({
		strategy: z.enum(["sql_only", "vector_only", "hybrid", "rejected"]),
		reason: z.string(),
		confidence: z.number().min(0).max(1),
	}),

	// SQL配置（如果需要）
	sqlConfig: z
		.object({
			tables: z.array(z.string()),
			canUseFuzzySearch: z.boolean(),
			fuzzyPatterns: z.array(z.string()).optional(),
			estimatedComplexity: z.enum(["simple", "moderate", "complex"]),
		})
		.optional(),

	// 向量搜索配置（如果需要）
	vectorConfig: z
		.object({
			queries: z.array(
				z.object({
					table: z.string(),
					fields: z.array(z.string()),
					searchText: z.string(),
					limit: z.number().default(10),
				}),
			),
			requiresReranking: z.boolean().default(false),
		})
		.optional(),

	// 混合搜索策略（如果需要）
	hybridConfig: z
		.object({
			description: z.string().describe("混合搜索的策略说明"),
		})
		.optional(),
});

export type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;

export const queryAnalyzerRouter = createTRPCRouter({
	analyze: publicProcedure
		.input(
			z.object({
				query: z.string().min(1),
				databaseSchema: z.string(),
				vectorizedFields: z.record(z.array(z.string())).optional(),
				context: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			console.log("[QueryAnalyzer] 开始分析查询:", input.query);

			// Generate cache key
			const cacheKey = cacheManager.generateCacheKey("query", {
				query: input.query,
				schemaHash: input.databaseSchema.substring(0, 100), // Use partial schema for cache key
				vectorizedFields: input.vectorizedFields,
			});

			// Check cache first
			const cached = await cacheManager.getQueryAnalysis(cacheKey);
			if (cached) {
				console.log("[QueryAnalyzer] 使用缓存结果");
				return {
					success: true,
					analysis: cached,
					executionTime: Date.now() - startTime,
					cached: true,
				};
			}

			try {
				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const queryId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

				const systemPrompt = `你是查询分析专家。分析用户查询并做出路由决策。

数据库Schema: ${input.databaseSchema}
向量化字段: ${JSON.stringify(input.vectorizedFields || {})}
上下文: ${input.context || "无"}

分析原则：
1. SQL优先：如果可以用SQL（包括LIKE）解决，选择sql_only
2. 向量搜索：只在需要语义理解时使用（同义词、相似概念）
3. 混合搜索：需要两种方法结合时使用（如：精确条件+语义搜索）
4. 拒绝处理：不可行或不清晰的查询

请提供：
- 可行性和清晰度评估
- 明确的路由决策
- 具体的执行配置`;

				const { object: analysis } = await generateObject({
					model: openai("gpt-4.1"),
					system: systemPrompt,
					prompt: `分析查询: "${input.query}"`,
					schema: QueryAnalysisSchema.omit({
						queryId: true,
						originalQuery: true,
						timestamp: true,
					}),
					temperature: 0.1,
				});

				const result: QueryAnalysis = {
					queryId,
					originalQuery: input.query,
					timestamp: new Date().toISOString(),
					...analysis,
				};

				// Cache the result
				await cacheManager.setQueryAnalysis(cacheKey, result);

				console.log("[QueryAnalyzer] 分析完成:", {
					strategy: result.routing.strategy,
					confidence: result.routing.confidence,
					feasible: result.feasibility.isFeasible,
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					analysis: result,
					executionTime: Date.now() - startTime,
					cached: false,
				};
			} catch (error) {
				console.error("[QueryAnalyzer] 分析错误:", error);
				throw new Error("查询分析失败");
			}
		}),
});
