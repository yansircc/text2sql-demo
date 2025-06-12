import { QdrantClient } from "@qdrant/qdrant-js";
import { env } from "../../env";
import { embedText } from "../embed-text";
import type {
	CollectionConfig,
	HybridSearchOptions,
	HybridSearchResult,
	PayloadIndexOptions,
	PointData,
} from "./schema";

interface SearchOptions {
	vector: number[];
	limit?: number;
	filter?: Record<string, unknown>;
}

class QdrantService {
	private client: QdrantClient;

	constructor() {
		this.client = new QdrantClient({
			url: env.QDRANT_URL,
			apiKey: env.QDRANT_API_KEY,
		});
	}

	// Collection operations
	async listCollections() {
		const response = await this.client.getCollections();
		return response.collections;
	}

	async collectionExists(collectionName: string): Promise<boolean> {
		try {
			const response = await this.client.collectionExists(collectionName);
			return response.exists;
		} catch (error) {
			console.error(
				`Error checking collection existence ${collectionName}:`,
				error,
			);
			return false;
		}
	}

	async getCollection(collectionName: string) {
		try {
			return await this.client.getCollection(collectionName);
		} catch (error) {
			console.error(`Error getting collection ${collectionName}:`, error);
			throw error;
		}
	}

	async createCollection(collectionName: string, config: CollectionConfig) {
		try {
			return await this.client.createCollection(collectionName, config);
		} catch (error) {
			console.error(`Error creating collection ${collectionName}:`, error);
			throw error;
		}
	}

	async deleteCollection(collectionName: string) {
		try {
			return await this.client.deleteCollection(collectionName);
		} catch (error) {
			console.error(`Error deleting collection ${collectionName}:`, error);
			throw error;
		}
	}

	// Payload index operations
	async createPayloadIndex(
		collectionName: string,
		options: PayloadIndexOptions,
	) {
		try {
			return await this.client.createPayloadIndex(collectionName, options);
		} catch (error) {
			console.error(
				`Error creating payload index in ${collectionName}:`,
				error,
			);
			throw error;
		}
	}

	// Point operations
	async upsertPoints(collectionName: string, points: PointData[], wait = true) {
		try {
			return await this.client.upsert(collectionName, {
				wait,
				points,
			});
		} catch (error) {
			console.error(`Error upserting points to ${collectionName}:`, error);
			throw error;
		}
	}

	async deletePoints(
		collectionName: string,
		pointIdsOrFilter: (string | number)[] | { filter: Record<string, unknown> },
		wait = true,
	) {
		try {
			if (Array.isArray(pointIdsOrFilter)) {
				// Delete by point IDs
				return await this.client.delete(collectionName, {
					wait,
					points: pointIdsOrFilter,
				});
			}

			// Delete by filter
			return await this.client.delete(collectionName, {
				wait,
				filter: pointIdsOrFilter.filter,
			});
		} catch (error) {
			console.error(`Error deleting points from ${collectionName}:`, error);
			throw error;
		}
	}

	async retrievePoints(collectionName: string, pointIds: (string | number)[]) {
		try {
			return await this.client.retrieve(collectionName, {
				ids: pointIds,
			});
		} catch (error) {
			console.error(`Error retrieving points from ${collectionName}:`, error);
			throw error;
		}
	}

	// Search operations
	async search(collectionName: string, options: SearchOptions) {
		try {
			return await this.client.search(collectionName, options);
		} catch (error) {
			console.error(`Error searching in ${collectionName}:`, error);
			throw error;
		}
	}

	async searchWithFilter(
		collectionName: string,
		vector: number[],
		filter: Record<string, unknown>,
		limit = 10,
	) {
		try {
			return await this.client.search(collectionName, {
				vector,
				filter,
				limit,
			});
		} catch (error) {
			console.error(`Error searching with filter in ${collectionName}:`, error);
			throw error;
		}
	}

	async searchBatch(
		collectionName: string,
		searches: {
			vector: number[];
			limit: number;
			filter?: Record<string, unknown>;
		}[],
	) {
		try {
			return await this.client.searchBatch(collectionName, {
				searches,
			});
		} catch (error) {
			console.error(`Error batch searching in ${collectionName}:`, error);
			throw error;
		}
	}

	// 通用混合搜索方法 - 支持任意字段的过滤和搜索
	/**
	 * 执行通用混合搜索 - 结合向量搜索和关键词搜索
	 * 支持任意字段的过滤条件和关键词搜索字段
	 * @param options 通用搜索选项
	 */
	async hybridSearch(options: HybridSearchOptions) {
		const {
			collectionName,
			query,
			limit,
			scoreNormalization,
			candidateMultiplier,
			filter,
			keywordFields,
			useShould,
		} = options;

		try {
			// 计算候选结果数量
			const candidateLimit = limit * candidateMultiplier;

			// 1. 生成查询嵌入
			const embedding = await embedText(query);

			if (!embedding) {
				throw new Error("Failed to generate query embedding");
			}

			// 2. 执行混合搜索
			const allResults: HybridSearchResult[] = [];

			// 2.1 向量搜索 - 语义相似度
			// 构建向量搜索的过滤器
			let vectorFilter: Record<string, unknown> = {};
			if (filter && Object.keys(filter).length > 0) {
				if (useShould) {
					// 使用should逻辑(OR) - 任意过滤条件匹配即可
					vectorFilter = {
						should: Object.entries(filter).map(([key, value]) => ({
							key,
							match: { value },
						})),
					};
				} else {
					// 使用must逻辑(AND) - 所有过滤条件都必须匹配
					vectorFilter = {
						must: Object.entries(filter).map(([key, value]) => ({
							key,
							match: { value },
						})),
					};
				}
			}

			const vectorResults = await this.search(collectionName, {
				vector: embedding,
				limit: candidateLimit,
				filter: vectorFilter,
			});

			// 2.2 关键词搜索 - 在指定字段中精确匹配
			const keywordSearches = keywordFields.map((field) => {
				let keywordFilter: Record<string, unknown>;

				if (filter && Object.keys(filter).length > 0) {
					if (useShould) {
						// 使用should逻辑 - 原有过滤条件作为should，关键词搜索作为must
						keywordFilter = {
							must: [
								{
									key: field,
									match: { text: query },
								},
							],
							should: Object.entries(filter).map(([key, value]) => ({
								key,
								match: { value },
							})),
						};
					} else {
						// 使用must逻辑 - 所有条件都必须匹配
						keywordFilter = {
							must: [
								...Object.entries(filter).map(([key, value]) => ({
									key,
									match: { value },
								})),
								{
									key: field,
									match: { text: query },
								},
							],
						};
					}
				} else {
					// 没有额外过滤条件，只搜索关键词字段
					keywordFilter = {
						must: [
							{
								key: field,
								match: { text: query },
							},
						],
					};
				}

				return this.search(collectionName, {
					vector: embedding,
					limit: candidateLimit,
					filter: keywordFilter,
				});
			});

			// 并行执行所有关键词搜索
			const keywordResultsArray = await Promise.all(keywordSearches);
			const keywordResults = keywordResultsArray.flat();

			// 3. 转换结果格式
			// 处理向量搜索结果
			if (vectorResults && vectorResults.length > 0) {
				const formattedResults = vectorResults.map((r) => ({
					id: String(r.id),
					score: r.score || 0,
					payload: r.payload as { text: string; [key: string]: unknown },
					metadata: {
						source: "vector" as const,
						originalScore: r.score,
						vector_rank: vectorResults.findIndex((vr) => vr.id === r.id),
						keyword_rank: -1,
					},
				}));

				allResults.push(...formattedResults);
			}

			// 处理关键词搜索结果
			if (keywordResults && keywordResults.length > 0) {
				// 去重并合并结果
				const existingIds = new Set(allResults.map((r) => r.id));

				for (const r of keywordResults) {
					const id = String(r.id);
					const keywordRank = keywordResults.findIndex((kr) => kr.id === r.id);

					// 如果ID已存在，只更新元数据
					if (existingIds.has(id)) {
						for (const existingResult of allResults) {
							if (existingResult.id === id && existingResult.metadata) {
								existingResult.metadata.keyword_rank = keywordRank;
								break;
							}
						}
					} else {
						// 创建新的结果项
						allResults.push({
							id,
							score: r.score || 0,
							payload: r.payload as { text: string; [key: string]: unknown },
							metadata: {
								source: "keyword" as const,
								originalScore: r.score,
								vector_rank: -1,
								keyword_rank: keywordRank,
							},
						});
					}
				}
			}

			// 4. 应用Reciprocal Rank Fusion (RRF)来合并结果
			const idToResultMap = new Map();
			const k = 20; // RRF参数k

			// 处理向量搜索排名
			for (const result of allResults) {
				if (result.metadata.vector_rank >= 0) {
					const rrf_score = 1 / (k + result.metadata.vector_rank);

					if (!idToResultMap.has(result.id)) {
						idToResultMap.set(result.id, {
							...result,
							rrf_score,
						});
					} else {
						const existing = idToResultMap.get(result.id);
						existing.rrf_score = (existing.rrf_score || 0) + rrf_score;
					}
				}
			}

			// 处理关键词搜索排名
			for (const result of allResults) {
				if (result.metadata.keyword_rank >= 0) {
					const rrf_score = 1 / (k + result.metadata.keyword_rank);

					if (!idToResultMap.has(result.id)) {
						idToResultMap.set(result.id, {
							...result,
							rrf_score,
						});
					} else {
						const existing = idToResultMap.get(result.id);
						existing.rrf_score = (existing.rrf_score || 0) + rrf_score;
					}
				}
			}

			// 5. 排序并归一化
			let fusedResults = Array.from(idToResultMap.values()).sort(
				(a, b) => (b.rrf_score || 0) - (a.rrf_score || 0),
			);

			// 归一化分数
			if (fusedResults.length > 0) {
				const maxScore = fusedResults[0].rrf_score;
				const minScore = fusedResults[fusedResults.length - 1].rrf_score;
				const scoreRange = maxScore - minScore;

				fusedResults = fusedResults.map((result) => {
					let normalizedScore: number;

					switch (scoreNormalization) {
						case "percentage":
							normalizedScore =
								scoreRange > 0
									? (result.rrf_score - minScore) / scoreRange
									: 1.0;
							normalizedScore = Math.round(normalizedScore * 100) / 100;
							break;
						case "exponential":
							normalizedScore = (result.rrf_score / maxScore) ** 0.5;
							normalizedScore = Math.round(normalizedScore * 100) / 100;
							break;
						default:
							normalizedScore = result.rrf_score;
					}

					return {
						...result,
						score: normalizedScore,
						metadata: {
							...result.metadata,
							raw_rrf_score: result.rrf_score,
						},
					};
				});
			}

			// 6. 返回最终结果
			return {
				results: fusedResults.slice(0, limit),
				fusionDetails: {
					totalResults: fusedResults.length,
					returnedResults: Math.min(fusedResults.length, limit),
					vectorResultsCount: vectorResults.length,
					keywordResultsCount: keywordResults.length,
					normalizationMethod: scoreNormalization,
					searchedFields: keywordFields,
					appliedFilter: filter,
				},
			};
		} catch (error) {
			console.error("Flexible hybrid search error:", error);
			throw error;
		}
	}
}

export const qdrantService = new QdrantService();
