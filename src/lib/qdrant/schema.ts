import { z } from "zod";

// Named Vectors Point 数据结构（主要数据结构）
const pointDataSchema = z.object({
	id: z.union([z.string(), z.number()]),
	vectors: z.record(z.array(z.number())), // 支持多个命名向量
	payload: z.record(z.unknown()).optional(),
});
type PointData = z.infer<typeof pointDataSchema>;

// 单个向量配置
const vectorConfigSchema = z.object({
	size: z.number(),
	distance: z.enum(["Cosine", "Euclid", "Dot"]),
});

// 集合配置 - 只支持Named Vectors
const collectionConfigSchema = z.object({
	vectors: z.record(vectorConfigSchema), // 只支持多向量配置（Named Vectors）
	optimizers_config: z
		.object({
			default_segment_number: z.number().optional(),
		})
		.optional(),
	replication_factor: z.number().optional(),
});
type CollectionConfig = z.infer<typeof collectionConfigSchema>;

const payloadIndexSchema = z.object({
	field_name: z.string(),
	field_schema: z.enum(["keyword", "integer", "float", "geo", "text"]),
	wait: z.boolean().optional(),
});
type PayloadIndexOptions = z.infer<typeof payloadIndexSchema>;

// 搜索选项
const namedVectorSearchOptionsSchema = z.object({
	vectorName: z.string(),
	vector: z.array(z.number()),
	limit: z.number().optional().default(10),
	filter: z.record(z.unknown()).optional(),
	withPayload: z.boolean().optional().default(true),
	withVectors: z.boolean().optional().default(false),
});
type NamedVectorSearchOptions = z.infer<typeof namedVectorSearchOptionsSchema>;

// 混合搜索选项
const hybridSearchOptionsSchema = z.object({
	collectionName: z.string(),
	query: z.string(),
	vectorNames: z.array(z.string()).optional().default(["text"]), // 支持多个向量名称
	limit: z.number().optional().default(10),
	scoreNormalization: z
		.enum(["none", "percentage", "exponential"])
		.optional()
		.default("percentage"),
	candidateMultiplier: z.number().optional().default(2),

	// 通用过滤器 - 支持任意字段组合
	filter: z.record(z.unknown()).optional(),

	// 关键词搜索的目标字段 - 支持多个字段
	keywordFields: z.array(z.string()).optional().default(["text"]),

	// 是否使用should逻辑（OR）还是must逻辑（AND）
	useShould: z.boolean().optional().default(false),
});
type HybridSearchOptions = z.infer<typeof hybridSearchOptionsSchema>;

const hybridSearchResultSchema = z.object({
	id: z.string(),
	score: z.number(),
	payload: z
		.object({
			text: z.string(),
		})
		.catchall(z.unknown()),
	metadata: z.object({
		source: z.enum(["vector", "keyword"]),
		originalScore: z.number().optional(),
		vector_rank: z.number(),
		keyword_rank: z.number(),
		raw_rrf_score: z.number().optional(),
		vectorName: z.string().optional(), // 添加向量名称信息
	}),
	rrf_score: z.number().optional(),
});
type HybridSearchResult = z.infer<typeof hybridSearchResultSchema>;

export {
	pointDataSchema,
	collectionConfigSchema,
	payloadIndexSchema,
	namedVectorSearchOptionsSchema,
	hybridSearchOptionsSchema,
	hybridSearchResultSchema,
	type PointData,
	type CollectionConfig,
	type PayloadIndexOptions,
	type NamedVectorSearchOptions,
	type HybridSearchOptions,
	type HybridSearchResult,
};
