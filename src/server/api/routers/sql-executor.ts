import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";

/**
 * SQL Executor Router - CloudFlare Workflow Step 4
 *
 * 职责：执行SQL语句并返回结果
 * - 验证SQL安全性
 * - 执行查询
 * - 格式化结果
 */

// SQL执行输入
export const SQLExecutorInputSchema = z.object({
	sql: z.string(),
	queryType: z.enum(["SELECT", "AGGREGATE", "COMPLEX"]),
	readOnly: z.boolean().default(true),
	timeout: z.number().default(30000).describe("执行超时时间(ms)"),
	maxRows: z.number().default(1000).describe("最大返回行数"),
});

// SQL执行结果
export const SQLExecutorResultSchema = z.object({
	rows: z.array(z.record(z.unknown())),
	rowCount: z.number(),
	executionTime: z.number(),
	truncated: z.boolean(),
	columns: z
		.array(
			z.object({
				name: z.string(),
				type: z.string().optional(),
			}),
		)
		.optional(),
});

export type SQLExecutorInput = z.infer<typeof SQLExecutorInputSchema>;
export type SQLExecutorResult = z.infer<typeof SQLExecutorResultSchema>;

export const sqlExecutorRouter = createTRPCRouter({
	execute: publicProcedure
		.input(SQLExecutorInputSchema)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			console.log("[SQLExecutor] 开始执行SQL:", {
				queryType: input.queryType,
				sqlQuery: input.sql,
				readOnly: input.readOnly,
			});

			try {
				// 安全检查
				if (input.readOnly) {
					const sqlUpper = input.sql.trim().toUpperCase();
					const allowedPrefixes = ["SELECT", "WITH", "EXPLAIN"];

					if (!allowedPrefixes.some((prefix) => sqlUpper.startsWith(prefix))) {
						throw new Error("只读模式下只允许SELECT查询");
					}
				}

				// 执行SQL
				let limitedSql = input.sql;

				// 如果没有LIMIT，自动添加以防止返回过多数据
				if (
					!input.sql.toUpperCase().includes("LIMIT") &&
					input.queryType === "SELECT"
				) {
					limitedSql = `${input.sql} LIMIT ${input.maxRows + 1}`;
				}

				const rows = await db.all(drizzleSql.raw(limitedSql));
				const executionTime = Date.now() - startTime;

				// 检查是否被截断
				const truncated = rows.length > input.maxRows;
				if (truncated) {
					rows.pop(); // 移除多余的行
				}

				// 提取列信息
				let columns: Array<{ name: string; type?: string }> = [];
				if (rows.length > 0) {
					const firstRow = rows[0] as Record<string, unknown>;
					columns = Object.keys(firstRow).map((name) => ({
						name,
						type: typeof firstRow[name],
					}));
				}

				console.log("[SQLExecutor] 执行完成:", {
					rowCount: rows.length,
					truncated,
					executionTime,
					columnCount: columns.length,
				});

				return {
					success: true,
					result: {
						rows,
						rowCount: rows.length,
						executionTime,
						truncated,
						columns,
					},
				};
			} catch (error: any) {
				console.error("[SQLExecutor] 执行错误:", error);
				throw new Error(`SQL执行失败: ${error.message}`);
			}
		}),

	// 验证SQL语法（不执行）
	validate: publicProcedure
		.input(
			z.object({
				sql: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// 使用EXPLAIN来验证SQL语法
				await db.run(drizzleSql.raw(`EXPLAIN QUERY PLAN ${input.sql}`));

				return {
					success: true,
					valid: true,
				};
			} catch (error: any) {
				return {
					success: true,
					valid: false,
					error: error.message,
				};
			}
		}),
});
