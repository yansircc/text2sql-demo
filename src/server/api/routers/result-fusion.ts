import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Result Fusion Router - CloudFlare Workflow Step 5
 *
 * 职责：AI智能融合搜索结果
 * - 理解用户意图
 * - 融合跨表数据
 * - 返回最相关结果
 */

// 融合输入 - 保持简单
export const ResultFusionInputSchema = z.object({
	userQuery: z.string(),
	vectorResults: z.array(z.any()).optional(),
	sqlResults: z.array(z.any()).optional(),
	maxResults: z.number().default(50),
});

// AI生成的结果 - 极简化
export const AIFusionResultSchema = z.object({
	// AI自由组合的结果数组
	results: z.array(z.record(z.any())),
});

export type ResultFusionInput = z.infer<typeof ResultFusionInputSchema>;
export type ResultFusionResult = z.infer<typeof AIFusionResultSchema>;

export const resultFusionRouter = createTRPCRouter({
	fuse: publicProcedure
		.input(ResultFusionInputSchema)
		.mutation(async ({ input }) => {
			try {
				const startTime = Date.now();
				console.log("[ResultFusion] 开始AI融合:", {
					query: input.userQuery.substring(0, 50) + "...",
					vectorCount: input.vectorResults?.length || 0,
					sqlCount: input.sqlResults?.length || 0,
				});

				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				// 构建简洁的提示词
				const systemPrompt = `你是数据融合专家。基于用户查询和搜索结果，返回最相关的数据。

用户查询: ${input.userQuery}

向量搜索结果:
${input.vectorResults ? JSON.stringify(input.vectorResults.slice(0, 5), null, 2) : "无"}

SQL搜索结果:
${input.sqlResults ? JSON.stringify(input.sqlResults.slice(0, 5), null, 2) : "无"}

要求:
1. 理解用户需求，挑选最相关的数据
2. 可以组合不同表的数据，通过companyId等字段关联
3. 返回结构清晰、信息完整的用户期待的结果
4. 最多返回${input.maxResults}条数据

**重要**: 必须返回以下JSON结构，以下为示范：
{
  "results": [
    {
      "id": 114,
      "name": "John Doe",
      "email": "john.doe@example.com"
    }
  ]
}

注意：
- 必须使用 "results" 作为数组字段名，不能是 "data" 或其他名称
- results 数组中的每个对象保持原始数据结构
- 不要添加额外的嵌套层级`;

				const { object: result } = await generateObject({
					model: openai("gpt-4.1"),
					system: systemPrompt,
					prompt: "生成融合结果",
					schema: AIFusionResultSchema,
					temperature: 0.1,
				});

				console.log("[ResultFusion] AI融合完成:", {
					resultCount: result.results.length,
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					results: result.results,
					count: result.results.length,
				};
			} catch (error) {
				console.error("[ResultFusion] 融合失败:", error);
				throw new Error("结果融合失败");
			}
		}),
});
