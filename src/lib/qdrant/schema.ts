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

// 2025年最佳实践：带量化的搜索选项
const vectorSearchOptionsSchema = z.object({
	vectorName: z.string(),
	vector: z.array(z.number()),
	limit: z.number().optional().default(10),
	filter: z.record(z.unknown()).optional(),
	withPayload: z.boolean().optional().default(true),
	withVectors: z.boolean().optional().default(false),
	hnswEf: z.number().optional(),
	exact: z.boolean().optional(),
	// 量化特定参数
	oversampling: z.number().optional(), // 过采样倍数
	rescore: z.boolean().optional(), // 是否重新评分
});
type VectorSearchOptions = z.infer<typeof vectorSearchOptionsSchema>;

export {
	pointDataSchema,
	collectionConfigSchema,
	payloadIndexSchema,
	vectorSearchOptionsSchema,
	type PointData,
	type CollectionConfig,
	type PayloadIndexOptions,
	type VectorSearchOptions,
};
