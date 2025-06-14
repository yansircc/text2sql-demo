import { Redis } from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
	if (!redis) {
		const isProduction = process.env.NODE_ENV === "production";

		// 根据环境选择默认配置
		const defaultHost = isProduction ? "redis.zeabur.internal" : "localhost";
		const defaultPort = 6379;

		redis = new Redis({
			host: process.env.REDIS_HOST ?? defaultHost,
			port: process.env.REDIS_PORT
				? Number.parseInt(process.env.REDIS_PORT)
				: defaultPort,
			password: process.env.REDIS_PASSWORD,
			db: process.env.REDIS_DB ? Number.parseInt(process.env.REDIS_DB) : 0,
			retryStrategy: (times: number) => {
				const delay = Math.min(times * 50, 2000);
				return delay;
			},
			reconnectOnError: (err: Error) => {
				const targetError = "READONLY";
				if (err.message.includes(targetError)) {
					// Only reconnect when the error contains "READONLY"
					return true;
				}
				return false;
			},
		});

		redis.on("error", (err: Error) => {
			console.error("Redis Client Error:", err);
		});

		redis.on("connect", () => {
			console.log(
				`✅ Redis connected successfully to ${redis?.options.host}:${redis?.options.port}`,
			);
		});
	}

	return redis;
}

// Cache key generators
export const CACHE_KEYS = {
	// Text2SQL cache keys
	queryAnalysis: (hash: string) => `text2sql:query:analysis:${hash}`,
	schemaSelection: (hash: string) => `text2sql:schema:selection:${hash}`,
	sqlGeneration: (hash: string) => `text2sql:sql:generation:${hash}`,
	embedding: (text: string) =>
		`text2sql:embedding:${Buffer.from(text).toString("base64")}`,

	// // 集合描述缓存 - 永久存储，只有手动刷新才会更新
	// collectionDescription: (dbName: string, collectionName: string) =>
	// 	`collection:desc:${dbName}:${collectionName}`,
	// // 数据库的所有集合列表
	// databaseCollections: (dbName: string) => `db:collections:${dbName}`,
	// // 查询翻译缓存 - 基于查询内容
	// queryTranslation: (query: string) =>
	// 	`query:translation:${Buffer.from(query).toString("base64")}`,
	// // 查询计划缓存 - 基于翻译后的查询
	// queryPlan: (professionalQuery: string, dbName: string) =>
	// 	`query:plan:${dbName}:${Buffer.from(professionalQuery).toString("base64")}`,
	// // 集合样本数据缓存
	// collectionSample: (dbName: string, collectionName: string) =>
	// 	`collection:sample:${dbName}:${collectionName}`,
	// // 清洗后的集合样本数据缓存
	// cleanedCollectionSample: (dbName: string, collectionName: string) =>
	// 	`collection:sample:cleaned:${dbName}:${collectionName}`,
	// // 查询历史列表
	// queryHistoryList: (dbName: string) => `query:history:list:${dbName}`,
	// // 单个查询历史详情
	// queryHistoryItem: (dbName: string, queryId: string) =>
	// 	`query:history:item:${dbName}:${queryId}`,
	// // 向量嵌入缓存
	// vectorEmbedding: (text: string, model: string) =>
	// 	`vector:embedding:${model}:${Buffer.from(text).toString("base64")}`,
	// // 语义查询缓存
	// semanticQuery: (query: string) =>
	// 	`semantic:query:${Buffer.from(query).toString("base64")}`,
	// // 搜索索引缓存
	// searchIndexes: (dbName: string) => `search:indexes:${dbName}`,
	// // 向量字段信息缓存
	// vectorFields: (dbName: string) => `vector:fields:${dbName}`,
	// // 数据库元数据缓存
	// databaseMetadata: (dbName: string) => `db:metadata:${dbName}`,
	// Add any other cache keys here as you want
};

// Cache TTL configuration
export const CACHE_TTL = {
	// 集合描述永不过期（除非手动刷新）
	COLLECTION_DESC: 0,

	// 集合列表缓存 24 小时
	COLLECTION_LIST: 60 * 60 * 24,

	// 查询翻译缓存 7 天
	QUERY_TRANSLATION: 60 * 60 * 24 * 7,

	// 查询计划缓存 7 天
	QUERY_PLAN: 60 * 60 * 24 * 7,

	// 样本数据缓存 1 小时
	COLLECTION_SAMPLE: 60 * 60,

	// 查询历史缓存 30 天
	QUERY_HISTORY: 60 * 60 * 24 * 30,

	// 向量嵌入缓存 30 天
	EMBEDDING: 60 * 60 * 24 * 30,

	// 搜索索引缓存 1 小时
	SEARCH_INDEXES: 60 * 60,

	// 数据库元数据缓存 24 小时
	DATABASE_METADATA: 60 * 60 * 24,
};
