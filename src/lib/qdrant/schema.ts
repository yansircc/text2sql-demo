import { z } from "zod";

const pointDataSchema = z.object({
	id: z.union([z.string(), z.number()]),
	vector: z.array(z.number()),
	payload: z.record(z.unknown()).optional(),
});
type PointData = z.infer<typeof pointDataSchema>;

const collectionConfigSchema = z.object({
	vectors: z.object({
		size: z.number(),
		distance: z.enum(["Cosine", "Euclid", "Dot"]),
	}),
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

// 搜索选项的Zod模式
const hybridSearchOptionsSchema = z.object({
	collectionName: z.string(),
	query: z.string(),
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
	}),
	rrf_score: z.number().optional(),
});
type HybridSearchResult = z.infer<typeof hybridSearchResultSchema>;

export {
	pointDataSchema,
	collectionConfigSchema,
	payloadIndexSchema,
	hybridSearchOptionsSchema,
	hybridSearchResultSchema,
	type PointData,
	type CollectionConfig,
	type PayloadIndexOptions,
	type HybridSearchOptions,
	type HybridSearchResult,
};
