import { QdrantClient } from "@qdrant/qdrant-js";
import { env } from "../../env";
import type {
	CollectionConfig,
	PayloadIndexOptions,
	PointData,
	VectorSearchOptions,
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

	// Search operations - 专注于 Named Vector 搜索
	async search(
		collectionName: string,
		options: VectorSearchOptions & {
			oversampling?: number;
			rescore?: boolean;
		},
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
				params: {
					hnsw_ef: options.hnswEf || 128,
					exact: options.exact || false,
					// 2025年最佳实践：默认启用量化优化
					quantization: {
						rescore: options.rescore !== false, // 默认启用重新评分
						oversampling: options.oversampling || 2.0, // 默认2倍过采样
					},
				},
			};

			return await this.client.search(collectionName, searchOptions as any);
		} catch (error) {
			console.error(`Error searching in ${collectionName}:`, error);
			throw error;
		}
	}

	// 2025年最佳实践：智能批量搜索（推荐使用）
	async searchBatch(
		collectionName: string,
		searches: VectorSearchOptions[],
		options?: {
			optimizeFor?: "speed" | "accuracy" | "balanced";
			adaptiveEf?: boolean; // 自适应ef值
			useQuantization?: boolean;
		},
	) {
		try {
			const opts = {
				optimizeFor: "balanced" as const,
				adaptiveEf: true,
				useQuantization: true,
				...options,
			};

			// 2025年最佳实践：根据优化目标自动调整参数
			const getOptimalParams = (searchType: typeof opts.optimizeFor) => {
				switch (searchType) {
					case "speed":
						return {
							hnsw_ef: 64,
							oversampling: 1.5,
							rescore: false,
						};
					case "accuracy":
						return {
							hnsw_ef: 512,
							oversampling: 4.0,
							rescore: true,
						};
					default:
						return {
							hnsw_ef: 128,
							oversampling: 2.0,
							rescore: true,
						};
				}
			};

			const optimalParams = getOptimalParams(opts.optimizeFor);

			const batchSearches = searches.map((search) => {
				// 2025年最佳实践：自适应ef值（基于搜索复杂度）
				let adaptiveEf = optimalParams.hnsw_ef;
				if (opts.adaptiveEf) {
					// 根据filter复杂度和limit调整ef值
					const filterComplexity = search.filter
						? Object.keys(search.filter).length
						: 0;
					const limitFactor = Math.min(search.limit / 10, 2);
					adaptiveEf = Math.min(
						optimalParams.hnsw_ef * (1 + filterComplexity * 0.2) * limitFactor,
						1024,
					);
				}

				return {
					vector: {
						name: search.vectorName,
						vector: search.vector,
					},
					limit: search.limit,
					filter: search.filter,
					with_payload: search.withPayload,
					with_vectors: search.withVectors,
					params: {
						hnsw_ef: Math.round(adaptiveEf),
						exact: search.exact || false,
						// 2025年最佳实践：智能量化配置
						...(opts.useQuantization && !search.exact
							? {
									quantization: {
										rescore: optimalParams.rescore,
										oversampling: optimalParams.oversampling,
									},
								}
							: {}),
					},
				};
			});

			return await this.client.searchBatch(collectionName, {
				searches: batchSearches as any,
			});
		} catch (error) {
			console.error(`Error batch searching in ${collectionName}:`, error);
			throw error;
		}
	}

	// 获取客户端实例（用于测试）
	public getClient() {
		return this.client;
	}
}

export const qdrantService = new QdrantService();
