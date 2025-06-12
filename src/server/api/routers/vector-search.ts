import { env } from "@/env";
import { embedText } from "@/lib/embed-text";
import { qdrantService } from "@/lib/qdrant/service";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

/**
 * Vector Search Router - CloudFlare Workflow Step 2A
 *
 * 职责：执行向量搜索
 * - 接收搜索配置
 * - 执行向量搜索
 * - 返回标准化结果
 */

// 向量搜索输入
export const VectorSearchInputSchema = z.object({
	queries: z.array(
		z.object({
			table: z.string(),
			fields: z.array(z.string()),
			searchText: z.string(),
			limit: z.number().default(10),
		}),
	),
	hnswEf: z.number().default(128).describe("HNSW搜索参数"),
});

// 向量搜索结果
export const VectorSearchResultSchema = z.object({
	results: z.array(
		z.object({
			id: z.number(),
			score: z.number(),
			table: z.string(),
			matchedField: z.string(),
			payload: z.record(z.unknown()),
			rank: z.number(),
		}),
	),
	searchTime: z.number(),
	totalResults: z.number(),
});

export type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>;
export type VectorSearchResult = z.infer<typeof VectorSearchResultSchema>;

export const vectorSearchRouter = createTRPCRouter({
	search: publicProcedure
		.input(VectorSearchInputSchema)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			console.log("[VectorSearch] 开始搜索:", {
				queryCount: input.queries.length,
				tables: [...new Set(input.queries.map((q) => q.table))],
			});

			const allResults: Array<{
				id: number;
				score: number;
				table: string;
				matchedField: string;
				payload: Record<string, unknown>;
				rank: number;
			}> = [];

			try {
				// 批量生成搜索向量
				const searchVectors = await Promise.all(
					input.queries.map((q) => embedText(q.searchText)),
				);

				// 并行执行所有搜索
				const searchPromises = input.queries.flatMap((query, queryIndex) => {
					const searchVector = searchVectors[queryIndex];
					if (!searchVector) return [];

					const tableName = query.table.replace("text2sql_", "");
					const collectionName = `${env.QDRANT_DEFAULT_COLLECTION}-${tableName}`;

					return query.fields.map(async (field) => {
						try {
							console.log(`[VectorSearch] 搜索 ${collectionName}.${field}`);

							// 检查集合是否存在
							const exists =
								await qdrantService.collectionExists(collectionName);
							if (!exists) {
								console.warn(`[VectorSearch] 集合 ${collectionName} 不存在`);
								return [];
							}

							// 检查字段是否存在
							const collectionInfo = await qdrantService
								.getClient()
								.getCollection(collectionName);
							const vectorFields = Object.keys(
								collectionInfo.config.params.vectors || {},
							);

							if (!vectorFields.includes(field)) {
								console.warn(`[VectorSearch] 字段 ${field} 不存在`);
								return [];
							}

							// 执行搜索
							const results = await qdrantService.search(collectionName, {
								vectorName: field,
								vector: searchVector,
								limit: query.limit,
								withPayload: true,
								withVectors: false,
								hnswEf: input.hnswEf,
							});

							return results.map((result, idx) => ({
								id: (result.payload?.companyId as number) || 0,
								score: result.score || 0,
								table: query.table,
								matchedField: field,
								payload: result.payload as Record<string, unknown>,
								rank: idx + 1,
							}));
						} catch (error) {
							console.error(`[VectorSearch] 搜索失败 ${field}:`, error);
							return [];
						}
					});
				});

				// 等待所有搜索完成
				const searchResults = await Promise.all(searchPromises.flat());
				const mergedResults = searchResults.flat();

				// 按分数排序并去重
				const uniqueResults = new Map<string, (typeof mergedResults)[0]>();
				mergedResults.forEach((result) => {
					const key = `${result.id}_${result.table}`;
					const existing = uniqueResults.get(key);
					if (!existing || result.score > existing.score) {
						uniqueResults.set(key, result);
					}
				});

				const sortedResults = Array.from(uniqueResults.values()).sort(
					(a, b) => b.score - a.score,
				);

				const searchTime = Date.now() - startTime;
				console.log("[VectorSearch] 搜索完成:", {
					totalResults: sortedResults.length,
					searchTime,
				});

				return {
					success: true,
					result: {
						results: sortedResults,
						searchTime,
						totalResults: sortedResults.length,
					},
				};
			} catch (error) {
				console.error("[VectorSearch] 搜索错误:", error);
				throw new Error("向量搜索失败");
			}
		}),
});
