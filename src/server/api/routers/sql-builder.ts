import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * SQL Builder Router - CloudFlare Workflow Step 3
 *
 * 职责：基于选定的schema构建SQL语句
 * - 接收精简schema和SQL提示
 * - 生成优化的SQL语句
 * - 返回SQL和元数据
 */

// SQL构建输入
export const SQLBuilderInputSchema = z.object({
	query: z.string(),
	slimSchema: z.record(z.any()),
	selectedTables: z.array(
		z.object({
			tableName: z.string(),
			fields: z.array(z.string()),
			reason: z.string(),
			isJoinTable: z.boolean(),
		}),
	),
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
		fuzzyPatterns: z.array(z.string()).optional(),
		vectorIds: z.array(z.number()).optional(),
	}),
	timeContext: z
		.object({
			currentTime: z.string(),
			timezone: z.string().default("UTC"),
		})
		.optional(),
});

// SQL构建结果
export const SQLBuilderResultSchema = z.object({
	sql: z.string(),
	queryType: z.enum(["SELECT", "AGGREGATE", "COMPLEX"]),
	estimatedRows: z.enum(["few", "moderate", "many"]).optional(),
	usesIndex: z.boolean(),
	warnings: z.array(z.string()).optional(),
	explanation: z.string().optional(),
});

export type SQLBuilderInput = z.infer<typeof SQLBuilderInputSchema>;
export type SQLBuilderResult = z.infer<typeof SQLBuilderResultSchema>;

export const sqlBuilderRouter = createTRPCRouter({
	build: publicProcedure
		.input(SQLBuilderInputSchema)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			console.log("[SQLBuilder] 开始构建SQL:", {
				tables: input.selectedTables.map((t) => t.tableName),
				hasJoins:
					input.sqlHints.joinHints && input.sqlHints.joinHints.length > 0,
				hasFuzzy:
					input.sqlHints.fuzzyPatterns &&
					input.sqlHints.fuzzyPatterns.length > 0,
				hasVectorIds:
					input.sqlHints.vectorIds && input.sqlHints.vectorIds.length > 0,
			});

			try {
				const anthropic = createAnthropic({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				// 构建SQL提示
				let sqlHintsPrompt = "";

				if (input.sqlHints.fuzzyPatterns?.length) {
					sqlHintsPrompt +=
						"\n模糊搜索模式: " + input.sqlHints.fuzzyPatterns.join(", ");
				}

				if (input.sqlHints.vectorIds?.length) {
					const idCount = input.sqlHints.vectorIds.length;
					sqlHintsPrompt += `\n向量搜索已找到 ${idCount} 个相关ID: `;
					if (idCount <= 10) {
						sqlHintsPrompt += input.sqlHints.vectorIds.join(", ");
					} else {
						sqlHintsPrompt +=
							input.sqlHints.vectorIds.slice(0, 10).join(", ") + "...";
					}
					sqlHintsPrompt += "\n可以使用 WHERE companyId IN (...) 来过滤";
				}

				if (input.sqlHints.joinHints?.length) {
					sqlHintsPrompt += "\nJOIN关系:";
					input.sqlHints.joinHints.forEach((join) => {
						sqlHintsPrompt += `\n- ${join.type} JOIN ${join.to} ON ${join.on}`;
					});
				}

				if (input.sqlHints.timeFields?.length) {
					sqlHintsPrompt += "\n时间字段:";
					input.sqlHints.timeFields.forEach((tf) => {
						sqlHintsPrompt += `\n- ${tf.table}.${tf.field}: ${tf.dataType}类型, ${tf.format}格式`;
					});
				}

				const systemPrompt = `你是SQLite SQL专家。基于提供的schema和提示生成优化的SQL语句。

查询需求: ${input.query}
${input.timeContext ? `当前时间: ${input.timeContext.currentTime}` : ""}

数据库Schema (仅包含所需表和字段):
${JSON.stringify(input.slimSchema, null, 2)}

使用的表和字段:
${input.selectedTables.map((t) => `- ${t.tableName}: [${t.fields.join(", ")}] (${t.reason})`).join("\n")}

SQL构建提示:${sqlHintsPrompt}

SQLite注意事项:
1. 时间函数：strftime, datetime, date, julianday
2. 字符串函数：LIKE, GLOB, substr, instr
3. 类型转换：CAST(x AS type)
4. 避免使用其他数据库特有函数

生成要求:
1. 编写高效、可读的SQL
2. 优先使用索引字段：${input.sqlHints.indexedFields?.join(", ") || "无"}
3. 适当使用LIMIT避免返回过多数据
4. 对于聚合查询，使用GROUP BY和聚合函数`;

				const { object: result } = await generateObject({
					model: anthropic("claude-sonnet-4-20250514"),
					system: systemPrompt,
					prompt: "生成SQL语句",
					schema: SQLBuilderResultSchema,
					temperature: 0.1,
				});

				console.log("[SQLBuilder] SQL构建完成:", {
					sqlLength: result.sql.length,
					queryType: result.queryType,
					usesIndex: result.usesIndex,
					hasWarnings: result.warnings && result.warnings.length > 0,
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					result,
					executionTime: Date.now() - startTime,
				};
			} catch (error) {
				console.error("[SQLBuilder] 构建错误:", error);
				throw new Error("SQL构建失败");
			}
		}),
});
