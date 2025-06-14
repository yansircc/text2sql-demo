import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Simple Result Fusion Router
 *
 * 简化版：AI只负责选择记录和字段，不生成数据
 */

// 融合输入
export const ResultFusionInputSchema = z.object({
	userQuery: z.string(),
	vectorResults: z.array(z.any()).optional(),
	sqlResults: z.array(z.any()).optional(),
	maxResults: z.number().default(50),
});

// AI的简单选择结果
const AISimpleSelectionSchema = z.object({
	// 从向量结果选择哪些记录（通过索引）
	vectorSelections: z
		.array(
			z.object({
				index: z.number(), // 记录索引
				fields: z.array(z.string()), // 要保留的字段
			}),
		)
		.default([]),

	// 从SQL结果选择哪些记录
	sqlSelections: z
		.array(
			z.object({
				index: z.number(),
				fields: z.array(z.string()),
			}),
		)
		.default([]),

	// 合并规则
	mergeRule: z.object({
		// 如果两个来源有相同ID的记录，如何处理
		mergeKey: z.string().default("companyId"),
		// 合并时的优先级
		priority: z.enum(["vector", "sql", "combine"]).default("combine"),
	}),
});

function executeSimpleMerge(
	vectorResults: any[],
	sqlResults: any[],
	selection: z.infer<typeof AISimpleSelectionSchema>,
): any[] {
	const results: any[] = [];
	const mergeKey = selection.mergeRule.mergeKey;
	const addedKeys = new Set<any>();

	// 处理向量选择
	selection.vectorSelections.forEach((sel) => {
		if (vectorResults && vectorResults[sel.index]) {
			const record = vectorResults[sel.index];
			const filtered: any = { _source: "vector" };

			// 只保留选中的字段
			sel.fields.forEach((field) => {
				if (record[field] !== undefined) {
					filtered[field] = record[field];
				}
			});

			const key = filtered[mergeKey];
			if (key) {
				addedKeys.add(key);
			}

			results.push(filtered);
		}
	});

	// 处理SQL选择
	selection.sqlSelections.forEach((sel) => {
		if (sqlResults && sqlResults[sel.index]) {
			const record = sqlResults[sel.index];
			const key = record[mergeKey];

			// 检查是否需要合并
			if (
				key &&
				addedKeys.has(key) &&
				selection.mergeRule.priority === "combine"
			) {
				// 找到已存在的记录并合并
				const existingIndex = results.findIndex((r) => r[mergeKey] === key);
				if (existingIndex >= 0) {
					// 合并字段
					sel.fields.forEach((field) => {
						if (record[field] !== undefined && !results[existingIndex][field]) {
							results[existingIndex][field] = record[field];
						}
					});
					results[existingIndex]._source = "both";
				}
			} else {
				// 新记录
				const filtered: any = { _source: "sql" };

				sel.fields.forEach((field) => {
					if (record[field] !== undefined) {
						filtered[field] = record[field];
					}
				});

				results.push(filtered);
			}
		}
	});

	return results;
}

export const resultFusionSimpleRouter = createTRPCRouter({
	fuse: publicProcedure
		.input(ResultFusionInputSchema)
		.mutation(async ({ input }) => {
			try {
				const startTime = Date.now();

				console.log("[SimpleFusion] 开始简单融合:", {
					query: input.userQuery.substring(0, 50) + "...",
					vectorCount: input.vectorResults?.length || 0,
					sqlCount: input.sqlResults?.length || 0,
				});

				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				// 为AI准备结构化的数据信息
				const vectorInfo = input.vectorResults?.map((r, idx) => ({
					index: idx,
					availableFields: Object.keys(r),
					preview: Object.entries(r)
						.slice(0, 3)
						.map(([k, v]) => `${k}: ${v}`),
				}));

				const sqlInfo = input.sqlResults?.map((r, idx) => ({
					index: idx,
					availableFields: Object.keys(r),
					preview: Object.entries(r)
						.slice(0, 3)
						.map(([k, v]) => `${k}: ${v}`),
				}));

				const systemPrompt = `你是数据选择专家。用户查询：${input.userQuery}

向量搜索结果（${input.vectorResults?.length || 0}条）：
${JSON.stringify(vectorInfo?.slice(0, 10), null, 2)}

SQL查询结果（${input.sqlResults?.length || 0}条）：
${JSON.stringify(sqlInfo?.slice(0, 10), null, 2)}

任务：
1. 从每个数据源选择最相关的记录（通过index）
2. 为每条记录选择用户需要的字段
3. 说明选择原因

注意：
- 只选择真正相关的记录，不要全选
- 只选择用户需要的字段，不要全部字段
- 如果两个来源有相同的记录（通过ID判断），考虑合并`;

				const { object: selection } = await generateObject({
					model: openai("gpt-4o-mini"),
					system: systemPrompt,
					prompt: "选择相关数据",
					schema: AISimpleSelectionSchema,
					temperature: 0.3,
				});

				console.log("[SimpleFusion] AI选择完成:", {
					vectorSelections: selection.vectorSelections.length,
					sqlSelections: selection.sqlSelections.length,
				});

				// 执行合并
				const mergedResults = executeSimpleMerge(
					input.vectorResults || [],
					input.sqlResults || [],
					selection,
				);

				console.log("[SimpleFusion] 融合完成:", {
					resultCount: mergedResults.length,
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					results: mergedResults.slice(0, input.maxResults),
					count: mergedResults.length,
					metadata: {
						vectorUsed: selection.vectorSelections.length > 0,
						sqlUsed: selection.sqlSelections.length > 0,
					},
				};
			} catch (error) {
				console.error("[SimpleFusion] 融合失败:", error);
				// 降级策略：如果AI失败，返回SQL结果
				if (input.sqlResults && input.sqlResults.length > 0) {
					return {
						success: true,
						results: input.sqlResults.slice(0, input.maxResults),
						count: input.sqlResults.length,
						metadata: {
							explanation: "AI融合失败，返回SQL结果",
							vectorUsed: false,
							sqlUsed: true,
						},
					};
				}
				// If no SQL results, try vector results
				if (input.vectorResults && input.vectorResults.length > 0) {
					console.log("[SimpleFusion] SQL结果为空，降级到向量结果");
					return {
						success: true,
						results: input.vectorResults.slice(0, input.maxResults),
						count: input.vectorResults.length,
						metadata: {
							explanation: "SQL结果为空，返回向量搜索结果",
							vectorUsed: true,
							sqlUsed: false,
						},
					};
				}
				throw new Error("简单结果融合失败");
			}
		}),
});
