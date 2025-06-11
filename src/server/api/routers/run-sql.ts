import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { sql as drizzleSql } from "drizzle-orm";
import { z } from "zod";

export const runSQLRouter = createTRPCRouter({
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

	// 获取示例 SQL 查询
	getSampleQueries: publicProcedure.query(() => {
		return {
			samples: [
				{
					title: "查看今天新增的客户",
					sql: `SELECT id, companyId, name, datetime(createdAt, 'unixepoch') as createdTime 
FROM text2sql_companies 
WHERE createdAt >= strftime('%s', 'now', 'start of day')
ORDER BY createdAt DESC 
LIMIT 20;`,
					description: "获取今天创建的所有客户信息",
				},
				{
					title: "统计每个业务员的客户数",
					sql: `SELECT 
  su.nickname,
  COUNT(DISTINCT cur.companyId) as customerCount
FROM text2sql_sales_users su
LEFT JOIN text2sql_company_user_relations cur ON su.userId = cur.userId
GROUP BY su.userId, su.nickname
ORDER BY customerCount DESC;`,
					description: "统计每个业务员负责的客户数量",
				},
				{
					title: "查看最近的跟进动态",
					sql: `SELECT 
  f.content,
  c.name as companyName,
  su.nickname as salesPerson,
  datetime(f.createTime, 'unixepoch') as followUpTime
FROM text2sql_follow_ups f
JOIN text2sql_companies c ON f.companyId = c.companyId
JOIN text2sql_sales_users su ON f.userId = su.userId
ORDER BY f.createTime DESC
LIMIT 50;`,
					description: "查看最近的50条跟进记录",
				},
				{
					title: "商机金额统计",
					sql: `SELECT 
  stageName,
  COUNT(*) as count,
  SUM(amount) as totalAmount,
  AVG(amount) as avgAmount
FROM text2sql_opportunities
WHERE amount > 0
GROUP BY stageName
ORDER BY totalAmount DESC;`,
					description: "按阶段统计商机的数量和金额",
				},
			],
		};
	}),
});
