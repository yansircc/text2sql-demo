import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { cacheManager } from "@/server/lib/cache-manager";

/**
 * Simplified SQL Builder - Optimized for faster AI generation
 *
 * Key improvements:
 * - 67% fewer fields in output
 * - Only essential SQL and type
 * - Pre-computed difficulty from analyzer
 */

// Minimal output schema
export const SimpleSQLBuilderResultSchema = z.object({
	sql: z.string(),
	queryType: z.enum(["SELECT", "AGGREGATE"]),
});

export type SimpleSQLBuilderResult = z.infer<
	typeof SimpleSQLBuilderResultSchema
>;

export const sqlBuilderRouter = createTRPCRouter({
	build: publicProcedure
		.input(
			z.object({
				query: z.string(),
				tables: z.array(z.string()),
				fields: z.record(z.array(z.string())),
				joins: z.array(z.string()).optional(),
				timeField: z.string().optional(),
				vectorIds: z.array(z.number()).optional(),
				difficulty: z.enum(["easy", "hard"]).default("easy"),
			}),
		)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			console.log("[SimpleSQLBuilder] 构建SQL:", {
				tables: input.tables,
				difficulty: input.difficulty,
				hasVectorFilter: !!input.vectorIds?.length,
			});

			// Generate cache key
			const cacheKey = cacheManager.generateCacheKey("sql-simple", {
				query: input.query,
				tables: input.tables,
				fields: input.fields,
				vectorIdCount: input.vectorIds?.length || 0,
			});

			// Check cache
			const cached = await cacheManager.getSqlGeneration(cacheKey);
			if (cached) {
				console.log("[SimpleSQLBuilder] 使用缓存结果");
				// Convert to simple format
				const simpleResult: SimpleSQLBuilderResult = {
					sql: cached.sql,
					queryType: cached.queryType as "SELECT" | "AGGREGATE",
				};
				return {
					success: true,
					result: simpleResult,
					executionTime: Date.now() - startTime,
					cached: true,
					model: "cached",
				};
			}

			try {
				// Select model based on difficulty
				const model =
					input.difficulty === "hard" ? "claude-3-sonnet-20240229" : "gpt-4.1";

				const ai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				// Build field list
				const fieldList = Object.entries(input.fields)
					.map(([table, fields]) => `${table}: ${fields.join(", ")}`)
					.join("\n");

				// Build hints
				const hints: string[] = [];
				if (input.joins?.length) {
					hints.push(`JOINs: ${input.joins.join("; ")}`);
				}
				if (input.timeField) {
					hints.push(`时间字段: ${input.timeField}`);
				}
				if (input.vectorIds?.length) {
					const idList =
						input.vectorIds.length > 10
							? `${input.vectorIds.slice(0, 10).join(",")}...`
							: input.vectorIds.join(",");
					hints.push(`向量搜索ID过滤: IN (${idList})`);
				}

				const systemPrompt = `你是SQLite专家。生成优化的SQL查询。

查询需求: ${input.query}

可用字段:
${fieldList}

${hints.length ? `提示:\n${hints.join("\n")}` : ""}

要求:
1. 生成可执行的SQLite SQL
2. 使用合适的LIMIT (默认100)
3. 判断查询类型: SELECT(简单查询) 或 AGGREGATE(统计/分组)

只返回:
- sql: 完整SQL语句
- queryType: SELECT 或 AGGREGATE`;

				const { object: result } = await generateObject({
					model: ai(model),
					system: systemPrompt,
					prompt: "生成SQL",
					schema: SimpleSQLBuilderResultSchema,
					temperature: 0.1,
				});

				// Don't cache simplified results - they're derived from full results

				console.log("[SimpleSQLBuilder] SQL构建完成:", {
					sqlLength: result.sql.length,
					queryType: result.queryType,
					model,
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					result,
					executionTime: Date.now() - startTime,
					cached: false,
					model,
				};
			} catch (error) {
				console.error("[SimpleSQLBuilder] 构建错误:", error);
				throw new Error("SQL构建失败");
			}
		}),
});
