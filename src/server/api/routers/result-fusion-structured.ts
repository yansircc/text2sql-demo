import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Structured Result Fusion Router
 *
 * 使用结构化的AI选择策略，而非自由生成
 * 1. AI选择要包含的记录ID
 * 2. AI选择要展示的字段
 * 3. AI决定合并策略
 * 4. 程序执行实际的数据合并
 */

// 融合输入
export const ResultFusionInputSchema = z.object({
	userQuery: z.string(),
	vectorResults: z.array(z.any()).optional(),
	sqlResults: z.array(z.any()).optional(),
	maxResults: z.number().default(50),
});

// AI选择结果 - 结构化的选择，而非自由生成
const AISelectionSchema = z.object({
	// 选择策略
	strategy: z.enum([
		"vector_only", // 只使用向量搜索结果
		"sql_only", // 只使用SQL结果
		"merge_by_id", // 通过ID合并两个结果集
		"union_all", // 合并所有结果（去重）
		"intersect", // 只返回两个结果集的交集
		"custom_selection", // 自定义选择特定记录
	]),

	// 如果是 custom_selection，指定要包含的记录
	selections: z
		.array(
			z.object({
				source: z.enum(["vector", "sql"]),
				indices: z.array(z.number()), // 选择的记录索引
			}),
		)
		.optional(),

	// 合并配置
	mergeConfig: z
		.object({
			// 主键字段（用于合并）
			primaryKey: z.string().default("companyId"),

			// 要展示的字段
			displayFields: z.array(
				z.object({
					field: z.string(),
					alias: z.string().optional(), // 字段别名
					source: z.enum(["vector", "sql", "both"]).optional(),
				}),
			),

			// 如果字段冲突，优先使用哪个数据源
			conflictResolution: z.enum(["vector", "sql", "latest"]).default("sql"),
		})
		.optional(),

	// 排序配置
	sorting: z
		.object({
			field: z.string(),
			direction: z.enum(["asc", "desc"]),
			source: z.enum(["vector", "sql"]).optional(),
		})
		.optional(),
});

// 执行实际的数据合并
function executeDataMerge(
	vectorResults: any[],
	sqlResults: any[],
	selection: z.infer<typeof AISelectionSchema>,
): any[] {
	let finalResults: any[] = [];

	switch (selection.strategy) {
		case "vector_only":
			finalResults = vectorResults || [];
			break;

		case "sql_only":
			finalResults = sqlResults || [];
			break;

		case "merge_by_id": {
			// 通过主键合并
			const primaryKey = selection.mergeConfig?.primaryKey || "companyId";
			const merged = new Map();

			// 先添加SQL结果
			sqlResults?.forEach((record) => {
				if (record[primaryKey]) {
					merged.set(record[primaryKey], { ...record, _source: "sql" });
				}
			});

			// 合并向量结果
			vectorResults?.forEach((record) => {
				const key = record[primaryKey];
				if (key) {
					if (merged.has(key)) {
						// 合并记录
						const existing = merged.get(key);
						merged.set(key, {
							...existing,
							...record,
							_source: "both",
							_merged: true,
						});
					} else {
						merged.set(key, { ...record, _source: "vector" });
					}
				}
			});

			finalResults = Array.from(merged.values());
			break;
		}

		case "union_all": {
			// 合并所有结果，通过ID去重
			const primaryKey = selection.mergeConfig?.primaryKey || "companyId";
			const seen = new Set();
			finalResults = [];

			// 先添加SQL结果
			sqlResults?.forEach((record) => {
				const key = record[primaryKey];
				if (key && !seen.has(key)) {
					seen.add(key);
					finalResults.push({ ...record, _source: "sql" });
				}
			});

			// 添加向量结果（去重）
			vectorResults?.forEach((record) => {
				const key = record[primaryKey];
				if (key && !seen.has(key)) {
					seen.add(key);
					finalResults.push({ ...record, _source: "vector" });
				}
			});
			break;
		}

		case "intersect": {
			// 只返回两个结果集都有的记录
			const primaryKey = selection.mergeConfig?.primaryKey || "companyId";
			const sqlIds = new Set(
				sqlResults?.map((r) => r[primaryKey]).filter(Boolean),
			);

			finalResults = (vectorResults || [])
				.filter((record) => sqlIds.has(record[primaryKey]))
				.map((record) => ({ ...record, _source: "intersect" }));
			break;
		}

		case "custom_selection": {
			// 根据AI的具体选择
			if (selection.selections) {
				selection.selections.forEach((sel) => {
					const source = sel.source === "vector" ? vectorResults : sqlResults;
					sel.indices.forEach((idx) => {
						if (source && source[idx]) {
							finalResults.push({
								...source[idx],
								_source: sel.source,
							});
						}
					});
				});
			}
			break;
		}
	}

	// 应用字段过滤
	if (selection.mergeConfig?.displayFields && finalResults.length > 0) {
		finalResults = finalResults.map((record) => {
			const filtered: any = {};

			selection.mergeConfig!.displayFields.forEach((fieldConfig) => {
				const fieldName = fieldConfig.field;
				const alias = fieldConfig.alias || fieldName;

				if (record[fieldName] !== undefined) {
					filtered[alias] = record[fieldName];
				}
			});

			// 保留元数据
			if (record._source) filtered._source = record._source;
			if (record._merged) filtered._merged = record._merged;

			return filtered;
		});
	}

	// 应用排序
	if (selection.sorting && finalResults.length > 0) {
		const { field, direction } = selection.sorting;
		finalResults.sort((a, b) => {
			const aVal = a[field];
			const bVal = b[field];

			if (aVal === bVal) return 0;
			if (aVal === null || aVal === undefined) return 1;
			if (bVal === null || bVal === undefined) return -1;

			const comparison = aVal < bVal ? -1 : 1;
			return direction === "asc" ? comparison : -comparison;
		});
	}

	return finalResults;
}

export const resultFusionStructuredRouter = createTRPCRouter({
	fuse: publicProcedure
		.input(ResultFusionInputSchema)
		.mutation(async ({ input }) => {
			try {
				const startTime = Date.now();

				console.log("[StructuredFusion] 开始结构化融合:", {
					query: input.userQuery.substring(0, 50) + "...",
					vectorCount: input.vectorResults?.length || 0,
					sqlCount: input.sqlResults?.length || 0,
				});

				// 准备数据摘要供AI分析
				const vectorSummary = input.vectorResults
					? {
							count: input.vectorResults.length,
							fields: Object.keys(input.vectorResults[0] || {}),
							samples: input.vectorResults.slice(0, 3),
						}
					: null;

				const sqlSummary = input.sqlResults
					? {
							count: input.sqlResults.length,
							fields: Object.keys(input.sqlResults[0] || {}),
							samples: input.sqlResults.slice(0, 3),
						}
					: null;

				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const systemPrompt = `你是数据融合策略专家。基于用户查询和两个数据源的结果，选择最佳的融合策略。

用户查询: ${input.userQuery}

向量搜索结果摘要:
${JSON.stringify(vectorSummary, null, 2)}

SQL查询结果摘要:
${JSON.stringify(sqlSummary, null, 2)}

请分析：
1. 用户真正想要什么数据
2. 两个数据源各自的优势
3. 是否需要合并数据，如何合并
4. 需要展示哪些字段

选择合适的策略：
- vector_only: 向量结果已经足够
- sql_only: SQL结果已经足够
- merge_by_id: 需要合并两个数据源以获得完整信息
- union_all: 需要所有结果（去重）
- intersect: 只要两个数据源都有的记录
- custom_selection: 需要精确选择特定记录`;

				const { object: selection } = await generateObject({
					model: openai("gpt-4o-mini"),
					system: systemPrompt,
					prompt: "选择数据融合策略",
					schema: AISelectionSchema,
					temperature: 0.2,
				});

				console.log("[StructuredFusion] AI选择策略:", {
					strategy: selection.strategy,
				});

				// 执行实际的数据合并
				const mergedResults = executeDataMerge(
					input.vectorResults || [],
					input.sqlResults || [],
					selection,
				);

				// 限制返回数量
				const finalResults = mergedResults.slice(0, input.maxResults);

				console.log("[StructuredFusion] 融合完成:", {
					resultCount: finalResults.length,
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					results: finalResults,
					count: finalResults.length,
					metadata: {
						strategy: selection.strategy,
						vectorUsed: [
							"vector_only",
							"merge_by_id",
							"union_all",
							"custom_selection",
						].includes(selection.strategy),
						sqlUsed: [
							"sql_only",
							"merge_by_id",
							"union_all",
							"intersect",
							"custom_selection",
						].includes(selection.strategy),
					},
				};
			} catch (error) {
				console.error("[StructuredFusion] 融合失败:", error);
				throw new Error("结构化结果融合失败");
			}
		}),
});
