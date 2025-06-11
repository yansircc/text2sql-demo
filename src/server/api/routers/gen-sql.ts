import { createAnthropic } from "@ai-sdk/anthropic";
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

				const anthropic = createAnthropic({
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
							"\n- 时间字段详情: " +
							hints.timeFieldHints
								.map((t) => {
									const parts = [
										`${t.field} (${t.dataType}类型`,
										`${t.format}格式)`,
									];
									if (t.sqlCastFunction) {
										parts.push(`转换函数: ${t.sqlCastFunction}`);
									}
									return parts.join(", ");
								})
								.join("; ");
					}
					if (hints.distinct) {
						sqlHintsPrompt += "\n- 需要去重 (DISTINCT)";
					}
				}

				// 简化的系统提示 - 只专注于生成 SQL
				const systemPrompt = `你是一个 SQL 生成专家。基于预分析结果，生成准确的 SQL 语句。

当前时间: ${currentTime}
**数据库类型: SQLite**

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

**数据库规范（SQLite）:**
1. **时间字段处理**：根据 timeFieldHints 中的类型信息和转换函数模板
   - 严格按照提供的 sqlCastFunction 模板生成时间比较条件
   - 确保数据类型匹配（避免字符串与数值直接比较）
2. **时间函数库**：
   - 时间戳生成：strftime('%s', ...) 
   - 时间格式化：datetime(...) 
   - 时间运算：使用修饰符如 '+1 day', '-1 day', 'start of day' 等
3. **类型转换**：当需要类型匹配时使用 CAST(...AS type)
4. **语法标准**：确保符合 SQLite 语法规范，避免其他数据库特有函数

只需要生成 SQL 语句，不需要其他任何分析或建议。`;

				console.log("systemPrompt: " + systemPrompt);

				const { object: result } = await generateObject({
					// model: openai("gpt-4.1"),
					model: anthropic("claude-sonnet-4-20250514"),
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
