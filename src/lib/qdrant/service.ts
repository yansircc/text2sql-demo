import { QdrantClient } from "@qdrant/qdrant-js";
import { env } from "../../env";
import { embedText } from "../embed-text";
import type {
	CollectionConfig,
	HybridSearchOptions,
	HybridSearchResult,
	NamedVectorSearchOptions,
	PayloadIndexOptions,
	PointData,
} from "./schema";

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

	// Point operations - 只支持 Named Vectors
	async upsertPoints(collectionName: string, points: PointData[], wait = true) {
		try {
			// 转换为 Qdrant 客户端期望的格式
			const qdrantPoints = points.map((point) => ({
				id: point.id,
				vectors: point.vectors,
				payload: point.payload,
			}));

			return await this.client.upsert(collectionName, {
				wait,
				points: qdrantPoints as any, // 使用 any 绕过类型检查
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

	// Search operations - 只支持 Named Vector 搜索
	async searchNamedVector(
		collectionName: string,
		options: NamedVectorSearchOptions,
	) {
		try {
			const searchOptions = {
				vector: {
					name: options.vectorName,
					vector: options.vector,
				},
				limit: options.limit,
				filter: options.filter,
				with_payload: options.withPayload,
				with_vectors: options.withVectors,
			};

			return await this.client.search(collectionName, searchOptions as any);
		} catch (error) {
			console.error(
				`Error searching named vector in ${collectionName}:`,
				error,
			);
			throw error;
		}
	}

	async searchBatch(
		collectionName: string,
		searches: NamedVectorSearchOptions[],
	) {
		try {
			const batchSearches = searches.map((search) => ({
				vector: {
					name: search.vectorName,
					vector: search.vector,
				},
				limit: search.limit,
				filter: search.filter,
				with_payload: search.withPayload,
				with_vectors: search.withVectors,
			}));

			return await this.client.searchBatch(collectionName, {
				searches: batchSearches as any,
			});
		} catch (error) {
			console.error(`Error batch searching in ${collectionName}:`, error);
			throw error;
		}
	}

	// 混合搜索 - 支持多个命名向量
	async hybridSearch(options: HybridSearchOptions) {
		const {
			collectionName,
			query,
			vectorNames,
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

			// 2.1 向量搜索 - 对每个命名向量进行搜索
			const vectorSearchPromises = vectorNames.map(async (vectorName) => {
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

				const results = await this.searchNamedVector(collectionName, {
					vectorName,
					vector: embedding,
					limit: candidateLimit,
					filter: vectorFilter,
					withPayload: true,
					withVectors: false,
				});

				return { vectorName, results };
			});

			const vectorSearchResults = await Promise.all(vectorSearchPromises);

			// 处理向量搜索结果
			for (const { vectorName, results } of vectorSearchResults) {
				if (results && results.length > 0) {
					const formattedResults = results.map((r, index) => ({
						id: String(r.id),
						score: r.score || 0,
						payload: r.payload as { text: string; [key: string]: unknown },
						metadata: {
							source: "vector" as const,
							originalScore: r.score,
							vector_rank: index,
							keyword_rank: -1,
							vectorName,
						},
					}));

					allResults.push(...formattedResults);
				}
			}

			// 2.2 关键词搜索 - 在指定字段中精确匹配
			const keywordSearchPromises = keywordFields.flatMap((field) =>
				vectorNames.map(async (vectorName) => {
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

					const results = await this.searchNamedVector(collectionName, {
						vectorName,
						vector: embedding,
						limit: candidateLimit,
						filter: keywordFilter,
						withPayload: true,
						withVectors: false,
					});

					return { vectorName, field, results };
				}),
			);

			const keywordSearchResults = await Promise.all(keywordSearchPromises);
			const keywordResults = keywordSearchResults.flatMap(
				({ vectorName, results }) =>
					results.map((r, index) => ({
						id: String(r.id),
						score: r.score || 0,
						payload: r.payload as { text: string; [key: string]: unknown },
						vectorName,
						keyword_rank: index,
					})),
			);

			// 处理关键词搜索结果
			if (keywordResults && keywordResults.length > 0) {
				// 去重并合并结果
				const existingIds = new Set(allResults.map((r) => r.id));

				for (const r of keywordResults) {
					// 如果ID已存在，只更新元数据
					if (existingIds.has(r.id)) {
						for (const existingResult of allResults) {
							if (existingResult.id === r.id && existingResult.metadata) {
								existingResult.metadata.keyword_rank = r.keyword_rank;
								break;
							}
						}
					} else {
						// 创建新的结果项
						allResults.push({
							id: r.id,
							score: r.score,
							payload: r.payload,
							metadata: {
								source: "keyword" as const,
								originalScore: r.score,
								vector_rank: -1,
								keyword_rank: r.keyword_rank,
								vectorName: r.vectorName,
							},
						});
					}
				}
			}

			// 3. 应用Reciprocal Rank Fusion (RRF)来合并结果
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

			// 4. 排序并归一化
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

			// 5. 返回最终结果
			return {
				results: fusedResults.slice(0, limit),
				fusionDetails: {
					totalResults: fusedResults.length,
					returnedResults: Math.min(fusedResults.length, limit),
					vectorResultsCount: vectorSearchResults.reduce(
						(sum, { results }) => sum + results.length,
						0,
					),
					keywordResultsCount: keywordResults.length,
					normalizationMethod: scoreNormalization,
					searchedFields: keywordFields,
					searchedVectors: vectorNames,
					appliedFilter: filter,
				},
			};
		} catch (error) {
			console.error("Hybrid search error:", error);
			throw error;
		}
	}
}

export const qdrantService = new QdrantService();
