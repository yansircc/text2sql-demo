import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { cacheManager } from "@/server/lib/cache-manager";

/**
 * Simplified Schema Selector - Optimized for faster AI generation
 *
 * Key improvements:
 * - 60% fewer fields in output
 * - Flat structure (no nested objects)
 * - Focus on essential schema selection
 */

// Simplified output schema
export const SimpleSchemaSelectorResultSchema = z.object({
	tables: z.array(z.string()),
	fields: z.record(z.array(z.string())),
	joins: z.array(z.string()).optional(),
	timeField: z.string().optional(),
});

export type SimpleSchemaSelectorResult = z.infer<
	typeof SimpleSchemaSelectorResultSchema
>;

export const schemaSelectorSimplifiedRouter = createTRPCRouter({
	selectSimple: publicProcedure
		.input(
			z.object({
				query: z.string(),
				tables: z.array(z.string()), // From simplified analyzer
				databaseSchema: z.string(),
				vectorIds: z.array(z.number()).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			console.log("[SimpleSchemaSelector] 选择schema:", {
				tables: input.tables,
				hasVectorIds: !!input.vectorIds?.length,
			});

			// Generate cache key
			const cacheKey = cacheManager.generateCacheKey("schema-simple", {
				query: input.query,
				tables: input.tables,
				vectorIdCount: input.vectorIds?.length || 0,
			});

			// Check cache
			const cached = await cacheManager.getSchemaSelection(cacheKey);
			if (cached) {
				console.log("[SimpleSchemaSelector] 使用缓存结果");
				// Convert to simple format
				const simpleResult: SimpleSchemaSelectorResult = {
					tables: cached.selectedTables.map((t: any) => t.tableName),
					fields: cached.selectedTables.reduce(
						(acc: any, t: any) => {
							acc[t.tableName] = t.fields;
							return acc;
						},
						{} as Record<string, string[]>,
					),
					joins: cached.sqlHints.joinHints?.map(
						(j: any) => `${j.from} ${j.type} JOIN ${j.to} ON ${j.on}`,
					),
					timeField: cached.sqlHints.timeFields?.[0]?.field,
				};
				return {
					success: true,
					result: simpleResult,
					executionTime: Date.now() - startTime,
					cached: true,
				};
			}

			try {
				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				// Parse schema and extract only needed tables
				const fullSchema = JSON.parse(input.databaseSchema);
				const relevantSchema: Record<string, any> = {};
				input.tables.forEach((table) => {
					if (fullSchema[table]) {
						relevantSchema[table] = fullSchema[table];
					}
				});

				// Create simplified context
				const schemaContext = Object.entries(relevantSchema)
					.map(([table, schema]) => {
						const fields = Object.keys(schema.columns || {});
						return `${table}: ${fields.slice(0, 10).join(", ")}${fields.length > 10 ? "..." : ""}`;
					})
					.join("\n");

				const systemPrompt = `你是数据库专家。为查询选择必要的字段。

查询: ${input.query}
${input.vectorIds ? `向量搜索已找到 ${input.vectorIds.length} 个ID` : ""}

表结构:
${schemaContext}

只返回:
1. tables: 使用的表名
2. fields: 每个表需要的字段 {"table1": ["field1", "field2"]}
3. joins: JOIN语句列表 (如需要)
4. timeField: 时间字段 (如需要)

选择原则:
- 只选必要字段
- 优先选择索引字段
- 包含JOIN所需的ID字段`;

				const { object: result } = await generateObject({
					model: openai("gpt-4o-mini"), // Fast model
					system: systemPrompt,
					prompt: "选择字段",
					schema: SimpleSchemaSelectorResultSchema,
					temperature: 0.1,
				});

				// Don't cache simplified results - they're derived from full results

				console.log("[SimpleSchemaSelector] 选择完成:", {
					tableCount: result.tables.length,
					totalFields: Object.values(result.fields).flat().length,
					hasJoins: !!result.joins?.length,
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					result,
					executionTime: Date.now() - startTime,
					cached: false,
				};
			} catch (error) {
				console.error("[SimpleSchemaSelector] 选择错误:", error);
				throw new Error("Schema选择失败");
			}
		}),
});
