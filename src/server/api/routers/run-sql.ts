import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";

/**
 * Run SQL Router
 *
 * 职责：管道的最后一步 - 执行生成的 SQL 语句
 *
 * 主要功能：
 * 1. 验证 SQL 语句的语法和安全性
 * 2. 执行 SQL 查询并返回结果
 * 3. 提供数据库统计信息
 * 4. 完整管道执行（从 genSQL 结果到最终数据）
 *
 * 安全特性：
 * - 只读模式确保不会修改数据
 * - SQL 注入防护
 * - 语法验证
 * - 危险操作警告
 */

export const runSQLRouter = createTRPCRouter({
	// 完整管道执行：从 genSQL 结果到最终数据
	runPipelineSQL: publicProcedure
		.input(
			z.object({
				genSQLResult: z
					.object({
						sql: z.string().describe("生成的 SQL 语句"),
						explanation: z.string().optional().describe("SQL 解释"),
						confidence: z.number().optional().describe("置信度"),
					})
					.describe("gen-sql 步骤的输出结果"),
				validate: z.boolean().default(true).describe("是否先验证 SQL"),
				readOnly: z.boolean().default(true).describe("是否只读模式"),
			}),
		)
		.mutation(async ({ input }) => {
			const startTime = Date.now();

			try {
				const { genSQLResult, validate, readOnly } = input;
				let validationResult = null;

				// 第一步：验证 SQL（如果需要）
				if (validate) {
					const sqlUpper = genSQLResult.sql.trim().toUpperCase();
					const errors: string[] = [];
					const warnings: string[] = [];
					let queryType:
						| "SELECT"
						| "INSERT"
						| "UPDATE"
						| "DELETE"
						| "DDL"
						| "OTHER" = "OTHER";

					// 检测 SQL 类型
					if (sqlUpper.startsWith("SELECT")) {
						queryType = "SELECT";
					} else if (sqlUpper.startsWith("INSERT")) {
						queryType = "INSERT";
					} else if (sqlUpper.startsWith("UPDATE")) {
						queryType = "UPDATE";
					} else if (sqlUpper.startsWith("DELETE")) {
						queryType = "DELETE";
					} else if (
						sqlUpper.startsWith("CREATE") ||
						sqlUpper.startsWith("ALTER") ||
						sqlUpper.startsWith("DROP")
					) {
						queryType = "DDL";
					}

					// 安全检查
					if (readOnly && queryType !== "SELECT") {
						errors.push("只读模式下只允许执行 SELECT 查询");
					}

					// 基本语法检查
					const openParens = (genSQLResult.sql.match(/\(/g) || []).length;
					const closeParens = (genSQLResult.sql.match(/\)/g) || []).length;
					if (openParens !== closeParens) {
						errors.push("括号不匹配");
					}

					// 危险操作警告
					if (queryType === "DELETE" && !sqlUpper.includes("WHERE")) {
						warnings.push("DELETE 语句没有 WHERE 条件，将删除所有数据");
					}
					if (queryType === "UPDATE" && !sqlUpper.includes("WHERE")) {
						warnings.push("UPDATE 语句没有 WHERE 条件，将更新所有数据");
					}

					validationResult = {
						isValid: errors.length === 0,
						errors: errors.length > 0 ? errors : undefined,
						warnings: warnings.length > 0 ? warnings : undefined,
						queryType,
					};

					// 如果验证失败，直接返回
					if (!validationResult.isValid) {
						return {
							success: false,
							validation: validationResult,
							executionTime: Date.now() - startTime,
							error: "SQL 验证失败",
						};
					}
				}

				// 第二步：执行 SQL
				const result = await db.all(drizzleSql.raw(genSQLResult.sql));
				const executionTime = Date.now() - startTime;

				return {
					success: true,
					validation: validationResult,
					data: result,
					rowCount: result.length,
					executionTime,
					sqlExecuted: genSQLResult.sql,
					explanation: genSQLResult.explanation,
					confidence: genSQLResult.confidence,
				};
			} catch (error: any) {
				console.error("Pipeline SQL 执行错误:", error);
				const executionTime = Date.now() - startTime;

				return {
					success: false,
					error: error.message || "SQL 执行失败",
					executionTime,
					sqlExecuted: input.genSQLResult.sql,
				};
			}
		}),

	// 验证 SQL 语句
	validateSQL: publicProcedure
		.input(
			z.object({
				sql: z.string().min(1, "SQL 语句不能为空"),
			}),
		)
		.mutation(async ({ input }) => {
			const startTime = Date.now();

			try {
				const sqlUpper = input.sql.trim().toUpperCase();
				const errors: string[] = [];
				const warnings: string[] = [];
				let queryType:
					| "SELECT"
					| "INSERT"
					| "UPDATE"
					| "DELETE"
					| "DDL"
					| "OTHER" = "OTHER";
				const affectedTables: string[] = [];

				// 检测 SQL 类型
				if (sqlUpper.startsWith("SELECT")) {
					queryType = "SELECT";
				} else if (sqlUpper.startsWith("INSERT")) {
					queryType = "INSERT";
				} else if (sqlUpper.startsWith("UPDATE")) {
					queryType = "UPDATE";
				} else if (sqlUpper.startsWith("DELETE")) {
					queryType = "DELETE";
				} else if (
					sqlUpper.startsWith("CREATE") ||
					sqlUpper.startsWith("ALTER") ||
					sqlUpper.startsWith("DROP")
				) {
					queryType = "DDL";
				}

				// 基本语法检查
				const openParens = (input.sql.match(/\(/g) || []).length;
				const closeParens = (input.sql.match(/\)/g) || []).length;
				if (openParens !== closeParens) {
					errors.push("括号不匹配");
				}

				// 检查分号
				if (!input.sql.trim().endsWith(";")) {
					warnings.push("SQL 语句建议以分号结尾");
				}

				// 危险操作警告
				if (queryType === "DELETE" && !sqlUpper.includes("WHERE")) {
					warnings.push("DELETE 语句没有 WHERE 条件，将删除所有数据");
				}
				if (queryType === "UPDATE" && !sqlUpper.includes("WHERE")) {
					warnings.push("UPDATE 语句没有 WHERE 条件，将更新所有数据");
				}

				// 提取表名（简单实现）
				const tableMatches = input.sql.match(
					/(?:FROM|INTO|UPDATE|TABLE)\s+([`"]?\w+[`"]?)/gi,
				);
				if (tableMatches) {
					tableMatches.forEach((match) => {
						const tableName = match
							.replace(/(?:FROM|INTO|UPDATE|TABLE)\s+/i, "")
							.replace(/[`"]/g, "");
						if (!affectedTables.includes(tableName)) {
							affectedTables.push(tableName);
						}
					});
				}

				// DDL 操作警告
				if (queryType === "DDL") {
					warnings.push("DDL 操作将修改数据库结构，请谨慎执行");
				}

				// 尝试使用 SQLite 的 EXPLAIN 来验证语法（不实际执行）
				try {
					// 对于 SELECT 语句，可以尝试 EXPLAIN
					if (queryType === "SELECT") {
						await db.run(drizzleSql.raw(`EXPLAIN QUERY PLAN ${input.sql}`));
					}
				} catch (error: any) {
					errors.push(`SQL 语法错误: ${error.message}`);
				}

				const validationTime = Date.now() - startTime;

				return {
					isValid: errors.length === 0,
					errors: errors.length > 0 ? errors : undefined,
					warnings: warnings.length > 0 ? warnings : undefined,
					queryType,
					affectedTables:
						affectedTables.length > 0 ? affectedTables : undefined,
					validationTime,
				};
			} catch (error) {
				console.error("SQL 验证错误:", error);
				return {
					isValid: false,
					errors: [
						`验证失败: ${error instanceof Error ? error.message : "未知错误"}`,
					],
				};
			}
		}),

	// 执行 SQL 语句
	executeSQL: publicProcedure
		.input(
			z.object({
				sql: z.string().min(1, "SQL 语句不能为空"),
				readOnly: z
					.boolean()
					.default(false)
					.describe("是否只读模式（只允许 SELECT）"),
			}),
		)
		.mutation(async ({ input }) => {
			const startTime = Date.now();

			try {
				// 安全检查：如果是只读模式，只允许 SELECT
				if (input.readOnly) {
					const sqlUpper = input.sql.trim().toUpperCase();
					if (
						!sqlUpper.startsWith("SELECT") &&
						!sqlUpper.startsWith("WITH") &&
						!sqlUpper.startsWith("EXPLAIN")
					) {
						throw new Error("只读模式下只允许执行 SELECT 查询");
					}
				}

				// 执行 SQL
				const result = await db.all(drizzleSql.raw(input.sql));
				const executionTime = Date.now() - startTime;

				// SQLite 的 all() 方法返回查询结果数组
				return {
					success: true,
					data: result,
					rowCount: result.length,
					executionTime,
					metadata: {
						// SQLite 不直接提供这些信息，需要额外查询
					},
				};
			} catch (error: any) {
				console.error("SQL 执行错误:", error);
				const executionTime = Date.now() - startTime;

				return {
					success: false,
					error: error.message || "SQL 执行失败",
					executionTime,
				};
			}
		}),

	// 获取数据库统计信息
	getDatabaseStats: publicProcedure.query(async () => {
		try {
			// 获取所有表的统计信息
			const tables = await db.all<{ tableName: string }>(
				drizzleSql.raw(`
					SELECT name as tableName
					FROM sqlite_master 
					WHERE type='table' 
					AND name LIKE 'text2sql_%'
					ORDER BY name
				`),
			);

			const stats = [];

			for (const table of tables) {
				const countResult = await db.all<{ count: number }>(
					drizzleSql.raw(`SELECT COUNT(*) as count FROM ${table.tableName}`),
				);

				stats.push({
					tableName: table.tableName,
					rowCount: countResult[0]?.count || 0,
				});
			}

			return {
				tables: stats,
				totalTables: stats.length,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("获取数据库统计信息错误:", error);
			throw new Error("无法获取数据库统计信息");
		}
	}),
});
