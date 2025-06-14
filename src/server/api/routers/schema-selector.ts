import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { cacheManager } from "@/server/lib/cache-manager";

/**
 * Schema Selector Router - CloudFlare Workflow Step 2B
 *
 * 职责：基于查询选择相关的表和字段
 * - 接收SQL配置
 * - 分析需要的表和字段
 * - 生成精简的schema
 */

// Schema选择输入
export const SchemaSelectorInputSchema = z.object({
	query: z.string(),
	sqlConfig: z.object({
		tables: z.array(z.string()),
		canUseFuzzySearch: z.boolean(),
		fuzzyPatterns: z.array(z.string()).optional(),
		estimatedComplexity: z.enum(["simple", "moderate", "complex"]),
	}),
	fullSchema: z.string(),
	vectorContext: z
		.object({
			hasResults: z.boolean(),
			ids: z.array(z.number()).optional(),
			topMatches: z
				.array(
					z.object({
						id: z.number(),
						score: z.number(),
						matchedField: z.string(),
					}),
				)
				.optional(),
		})
		.optional(),
});

// Schema选择结果
export const SchemaSelectorResultSchema = z.object({
	selectedTables: z.array(
		z.object({
			tableName: z.string(),
			fields: z.array(z.string()),
			reason: z.string(),
			isJoinTable: z.boolean().default(false),
		}),
	),
	slimSchema: z.record(z.any()),
	compressionRatio: z.number(),
	sqlHints: z.object({
		timeFields: z
			.array(
				z.object({
					table: z.string(),
					field: z.string(),
					dataType: z.enum(["integer", "text", "real"]),
					format: z.enum(["timestamp", "datetime", "date"]),
				}),
			)
			.optional(),
		joinHints: z
			.array(
				z.object({
					from: z.string(),
					to: z.string(),
					on: z.string(),
					type: z.enum(["INNER", "LEFT", "RIGHT"]),
				}),
			)
			.optional(),
		indexedFields: z.array(z.string()).optional(),
	}),
});

export type SchemaSelectorInput = z.infer<typeof SchemaSelectorInputSchema>;
export type SchemaSelectorResult = z.infer<typeof SchemaSelectorResultSchema>;

export const schemaSelectorRouter = createTRPCRouter({
	select: publicProcedure
		.input(SchemaSelectorInputSchema)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			console.log("[SchemaSelector] 开始选择schema:", {
				query: input.query.substring(0, 50) + "...",
				tables: input.sqlConfig.tables,
				hasVectorContext: !!input.vectorContext?.hasResults,
			});

			// Generate cache key
			const cacheKey = cacheManager.generateCacheKey("schema", {
				query: input.query,
				sqlConfig: input.sqlConfig,
				schemaHash: input.fullSchema.substring(0, 100), // Use partial schema for cache key
				vectorIds: input.vectorContext?.ids?.slice(0, 10), // Include top vector IDs in cache key
			});

			// Check cache first
			const cached = await cacheManager.getSchemaSelection(cacheKey);
			if (cached) {
				console.log("[SchemaSelector] 使用缓存结果");
				return {
					success: true,
					result: cached,
					executionTime: Date.now() - startTime,
					cached: true,
				};
			}

			try {
				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const fullSchema = JSON.parse(input.fullSchema);

				// 构建向量上下文提示
				let vectorContextPrompt = "";
				if (input.vectorContext?.hasResults) {
					vectorContextPrompt = `
向量搜索已找到 ${input.vectorContext.ids?.length || 0} 个相关记录
ID列表: ${input.vectorContext.ids?.slice(0, 10).join(", ")}${(input.vectorContext.ids?.length || 0) > 10 ? "..." : ""}
顶部匹配: ${input.vectorContext.topMatches?.map((m) => `${m.matchedField}(${m.score.toFixed(2)})`).join(", ")}

请考虑：
1. 可以使用这些ID作为WHERE IN条件
2. 或作为JOIN条件的一部分`;
				}

				const systemPrompt = `你是数据库Schema选择专家。基于查询需求选择必要的表和字段。

查询: ${input.query}
预选表: ${input.sqlConfig.tables.join(", ")}
复杂度: ${input.sqlConfig.estimatedComplexity}
${input.sqlConfig.canUseFuzzySearch ? `支持模糊搜索: ${input.sqlConfig.fuzzyPatterns?.join(", ")}` : ""}
${vectorContextPrompt}

数据库Schema (仅包含相关表):
${JSON.stringify(fullSchema, null, 2)}

请选择：
1. 必要的表和字段（最小化选择）
2. 识别时间字段及其格式
3. 识别可能的JOIN关系
4. 标记已建索引的字段

重要提示 - SQLite 数据类型映射：
- JavaScript的 "number" 类型在SQLite中应该是:
  * 整数时间戳、ID等: "integer"
  * 浮点数、金额等: "real"
  * 绝对不要使用 "number"
- JavaScript的 "string" 类型在SQLite中是: "text"
- 时间格式可能是: "timestamp", "datetime", 或 "date"`;

				const { object: selection } = await generateObject({
					model: openai("gpt-4.1"),
					system: systemPrompt,
					prompt: "选择必要的表和字段",
					schema: SchemaSelectorResultSchema.omit({
						slimSchema: true,
						compressionRatio: true,
					}),
					temperature: 0.1,
				});

				// 构建精简schema
				const slimSchema: Record<string, any> = {};
				selection.selectedTables.forEach((table) => {
					if (fullSchema[table.tableName]) {
						slimSchema[table.tableName] = {
							...fullSchema[table.tableName],
							properties: {},
						};

						// 只保留选中的字段
						table.fields.forEach((field) => {
							if (fullSchema[table.tableName].properties?.[field]) {
								slimSchema[table.tableName].properties[field] =
									fullSchema[table.tableName].properties[field];
							}
						});
					}
				});

				// 确保 isJoinTable 有默认值
				const selectedTablesWithDefaults = selection.selectedTables.map(
					(table) => ({
						...table,
						isJoinTable: table.isJoinTable ?? false,
					}),
				);

				const result: SchemaSelectorResult = {
					selectedTables: selectedTablesWithDefaults,
					slimSchema,
					compressionRatio:
						Object.keys(slimSchema).length / Object.keys(fullSchema).length,
					sqlHints: selection.sqlHints,
				};

				// Cache the result
				await cacheManager.setSchemaSelection(cacheKey, result);

				console.log("[SchemaSelector] 选择完成:", {
					selectedTables: result.selectedTables.length,
					totalFields: result.selectedTables.reduce(
						(sum, t) => sum + t.fields.length,
						0,
					),
					compressionRatio: result.compressionRatio.toFixed(2),
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					result,
					executionTime: Date.now() - startTime,
					cached: false,
				};
			} catch (error) {
				console.error("[SchemaSelector] 选择错误:", error);
				throw new Error("Schema选择失败");
			}
		}),
});
