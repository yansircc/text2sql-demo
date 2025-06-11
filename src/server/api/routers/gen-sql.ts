import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { PreSQLSchema } from "./pre-sql";

// SQL 生成结果 Schema - 极简版，只有 SQL
const SQLGenerationResult = z.object({
	sql: z.string().describe("生成的 SQL 语句"),
});

// // PreSQL 输入结构（包含新增的 sqlHints）
// const PreSQLInput = z.object({
// 	difficulty: z.enum(["simple", "medium", "hard"]),
// 	tablesAndFields: z.string(),
// 	selectedTables: z.array(
// 		z.object({
// 			tableName: z.string(),
// 			fields: z.array(z.string()),
// 			reason: z.string(),
// 		}),
// 	),
// 	analysisSteps: z.array(z.string()),
// 	timeRange: z.string().optional(),
// 	needsSemanticSearch: z.boolean(),
// 	queryType: z.string(),
// 	difficultyReason: z.string().optional(),
// 	sqlHints: z
// 		.object({
// 			orderBy: z
// 				.array(
// 					z.object({
// 						field: z.string(),
// 						direction: z.enum(["ASC", "DESC"]),
// 					}),
// 				)
// 				.optional(),
// 			groupBy: z.array(z.string()).optional(),
// 			limit: z.number().optional(),
// 			aggregations: z
// 				.array(
// 					z.object({
// 						function: z.enum(["COUNT", "SUM", "AVG", "MAX", "MIN"]),
// 						field: z.string(),
// 						alias: z.string().optional(),
// 					}),
// 				)
// 				.optional(),
// 			joins: z
// 				.array(
// 					z.object({
// 						type: z.enum(["INNER", "LEFT", "RIGHT", "FULL"]),
// 						fromTable: z.string(),
// 						toTable: z.string(),
// 						condition: z.string(),
// 					}),
// 				)
// 				.optional(),
// 			specialConditions: z.array(z.string()).optional(),
// 			timeFieldHints: z
// 				.array(
// 					z.object({
// 						field: z.string(),
// 						format: z.enum(["timestamp", "datetime", "date"]),
// 						timezone: z.string().optional(),
// 					}),
// 				)
// 				.optional(),
// 			distinct: z.boolean().optional(),
// 		})
// 		.optional(),
// });

export const genSQLRouter = createTRPCRouter({
	// 基于 PreSQL 生成 SQL 语句 - 只生成 SQL，不做任何其他分析
	generateSQL: publicProcedure
		.input(
			z.object({
				preSQL: PreSQLSchema.describe("PreSQL 分析结果"),
				slimSchema: z
					.string()
					.describe("基于精选表字段生成的精简数据库 schema JSON"),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const currentTime = new Date().toISOString();

				// 构建 SQL 提示部分
				let sqlHintsPrompt = "";
				if (input.preSQL.sqlHints) {
					const hints = input.preSQL.sqlHints;

					if (hints.orderBy?.length) {
						sqlHintsPrompt +=
							"\n- 排序要求: " +
							hints.orderBy.map((o) => `${o.field} ${o.direction}`).join(", ");
					}
					if (hints.groupBy?.length) {
						sqlHintsPrompt += "\n- 分组字段: " + hints.groupBy.join(", ");
					}
					if (hints.limit !== undefined) {
						sqlHintsPrompt += "\n- 限制结果数: " + hints.limit + " 条";
					}
					if (hints.aggregations?.length) {
						sqlHintsPrompt +=
							"\n- 聚合函数: " +
							hints.aggregations
								.map(
									(a) =>
										`${a.function}(${a.field})${a.alias ? ` AS ${a.alias}` : ""}`,
								)
								.join(", ");
					}
					if (hints.joins?.length) {
						sqlHintsPrompt +=
							"\n- 表关联: " +
							hints.joins
								.map((j) => `${j.type} JOIN ${j.toTable} (${j.condition})`)
								.join("; ");
					}
					if (hints.specialConditions?.length) {
						sqlHintsPrompt +=
							"\n- 特殊条件: " + hints.specialConditions.join("; ");
					}
					if (hints.timeFieldHints?.length) {
						sqlHintsPrompt +=
							"\n- 时间字段格式: " +
							hints.timeFieldHints
								.map((t) => `${t.field} 是 ${t.format} 格式`)
								.join(", ");
					}
					if (hints.distinct) {
						sqlHintsPrompt += "\n- 需要去重 (DISTINCT)";
					}
				}

				// 简化的系统提示 - 只专注于生成 SQL
				const systemPrompt = `你是一个 SQL 生成专家。基于预分析结果，生成准确的 SQL 语句。

当前时间: ${currentTime}

**查询类型:** ${input.preSQL.queryType}
**时间范围:** ${input.preSQL.timeRange || "无特定时间限制"}

**分析步骤:**
${input.preSQL.analysisSteps.map((step, index) => index + 1 + ". " + step).join("\n")}

**数据库 Schema (精简版):**
${input.slimSchema}

**使用的表和字段:**
${input.preSQL.selectedTables
	.map(
		(table) => "- " + table.tableName + ": [" + table.fields.join(", ") + "]",
	)
	.join("\n")}

${sqlHintsPrompt ? `**SQL 生成提示:**${sqlHintsPrompt}` : ""}

**重要说明:**
1. 对于 timestamp 格式的时间字段，需要正确处理：
   - 使用 FROM_UNIXTIME() 函数转换为可读日期（MySQL）
   - 或使用适当的时间比较（直接比较时间戳值）
2. "今天"是指从今天 00:00:00 到 23:59:59
3. 确保 SQL 语法正确，字段名和表名与 schema 完全一致
4. 如果有排序要求但没指定字段，默认使用时间字段倒序

只需要生成 SQL 语句，不需要其他任何分析或建议。`;

				console.log("systemPrompt: " + systemPrompt);

				const { object: result } = await generateObject({
					model: openai("gpt-4o-mini"),
					system: systemPrompt,
					prompt: "请生成 SQL 语句。",
					schema: SQLGenerationResult,
					temperature: 0.1, // 低温度确保一致性
				});

				console.log("result: " + result.sql);

				return {
					success: true,
					sql: result.sql,
					timestamp: new Date().toISOString(),
				};
			} catch (error) {
				console.error("SQL 生成错误:", error);
				throw new Error("SQL 生成服务暂时不可用，请稍后再试");
			}
		}),

	// 获取 SQL 生成的 schema 定义
	getSQLSchema: publicProcedure.query(() => {
		return {
			inputSchema: PreSQLSchema,
			outputSchema: SQLGenerationResult,
			version: "2.1.0-with-sql-hints",
			description: "SQL 生成系统的数据结构定义（增强版）",
		};
	}),
});
