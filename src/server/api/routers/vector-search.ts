import { env } from "@/env";
import { embedText } from "@/lib/embed-text";
import { qdrantService } from "@/lib/qdrant/service";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { cacheManager } from "@/server/lib/cache-manager";
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
				// 批量生成搜索向量 with caching
				const searchVectors = await Promise.all(
					input.queries.map(async (q) => {
						// Check cache first
						const cached = await cacheManager.getEmbedding(q.searchText);
						if (cached) {
							console.log(
								`[VectorSearch] 使用缓存的向量: ${q.searchText.substring(0, 20)}...`,
							);
							return cached;
						}

						// Generate new embedding
						const embedding = await embedText(q.searchText);

						// Cache the embedding
						if (embedding) {
							await cacheManager.setEmbedding(q.searchText, embedding);
						}

						return embedding;
					}),
				);

				// Group queries by table for batch processing
				const queriesByTable = input.queries.reduce(
					(acc, query, queryIndex) => {
						const searchVector = searchVectors[queryIndex];
						if (!searchVector) return acc;

						const tableName = query.table.replace("text2sql_", "");
						if (!acc[tableName]) {
							acc[tableName] = [];
						}
						acc[tableName].push({ ...query, searchVector, queryIndex });
						return acc;
					},
					{} as Record<
						string,
						Array<
							(typeof input.queries)[0] & {
								searchVector: number[];
								queryIndex: number;
							}
						>
					>,
				);

				// Process each table's queries in parallel
				const tableSearchPromises = Object.entries(queriesByTable).map(
					async ([tableName, tableQueries]) => {
						const collectionName = `${env.QDRANT_DEFAULT_COLLECTION}-${tableName}`;

						// Check collection existence once per table
						const exists = await qdrantService.collectionExists(collectionName);
						if (!exists) {
							console.warn(`[VectorSearch] 集合 ${collectionName} 不存在`);
							return [];
						}

						// Get collection info once per table
						const collectionInfo = await qdrantService
							.getClient()
							.getCollection(collectionName);
						const vectorFields = Object.keys(
							collectionInfo.config.params.vectors || {},
						);

						// Process all field searches for this table in parallel
						const fieldSearchPromises = tableQueries.flatMap((query) => {
							return query.fields
								.filter((field) => vectorFields.includes(field))
								.map(async (field) => {
									try {
										console.log(
											`[VectorSearch] 搜索 ${collectionName}.${field}`,
										);

										// Execute search
										const results = await qdrantService.search(collectionName, {
											vectorName: field,
											vector: query.searchVector,
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

						const fieldResults = await Promise.all(fieldSearchPromises);
						return fieldResults.flat();
					},
				);

				// 等待所有搜索完成
				const searchResults = await Promise.all(tableSearchPromises);
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
