import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { cacheManager } from "@/server/lib/cache-manager";

/**
 * SQL Builder Router - CloudFlare Workflow Step 3
 *
 * 职责：基于选定的schema构建SQL语句
 * - 接收精简schema和SQL提示
 * - 生成优化的SQL语句
 * - 返回SQL和元数据
 */

// Difficulty estimation for SQL query generation
interface QueryDifficulty {
	level: "easy" | "hard" | "very_hard";
	factors: string[];
	score: number;
}

function estimateQueryDifficulty(input: SQLBuilderInput): QueryDifficulty {
	let score = 0;
	const factors: string[] = [];

	// 1. Number of tables (JOINs complexity)
	const tableCount = input.selectedTables.length;
	if (tableCount === 1) {
		score += 0;
		factors.push("单表查询");
	} else if (tableCount === 2) {
		score += 20;
		factors.push("双表JOIN");
	} else if (tableCount >= 3) {
		score += 40;
		factors.push(`多表JOIN (${tableCount}个表)`);
	}

	// 2. JOIN complexity
	if (input.sqlHints.joinHints?.length) {
		const joinCount = input.sqlHints.joinHints.length;
		if (joinCount >= 3) {
			score += 30;
			factors.push(`复杂JOIN (${joinCount}个关联)`);
		} else if (joinCount >= 2) {
			score += 20;
			factors.push("多个JOIN");
		} else {
			score += 10;
			factors.push("简单JOIN");
		}
	}

	// 3. Time-based queries
	if (input.sqlHints.timeFields?.length) {
		score += 5; // Reduced from 15
		factors.push("时间相关查询");

		// Time range queries are harder
		if (
			input.query
				.toLowerCase()
				.match(/between|range|period|last\s+\d+|过去|最近|趋势|对比/)
		) {
			score += 15; // Increased from 10 for complex time analysis
			factors.push("时间范围查询");
		}
	}

	// 4. Aggregation complexity
	const aggregationKeywords =
		/group\s+by|count|sum|avg|max|min|having|分组|统计|汇总|平均|最大|最小/i;
	if (input.query.match(aggregationKeywords)) {
		// Check if it's a simple COUNT without GROUP BY
		const hasGroupBy = /group\s+by|分组/i.test(input.query);
		const hasMultipleAggregations =
			(input.query.match(/count|sum|avg|max|min|统计|汇总|平均|最大|最小/gi)
				?.length || 0) > 1;

		if (!hasGroupBy && !hasMultipleAggregations) {
			score += 5; // Simple aggregation like COUNT(*)
			factors.push("简单聚合");
		} else {
			score += 20; // Complex aggregation
			factors.push("聚合查询");
		}

		// Multiple aggregations or HAVING clause
		if (
			input.query.toLowerCase().includes("having") ||
			hasMultipleAggregations
		) {
			score += 15;
			factors.push("复杂聚合");
		}
	}

	// 5. Subqueries or CTEs
	if (input.query.toLowerCase().match(/subquery|子查询|cte|with\s+as/)) {
		score += 35;
		factors.push("子查询/CTE");
	}

	// 6. Window functions
	if (
		input.query
			.toLowerCase()
			.match(/over|partition|row_number|rank|dense_rank|窗口函数/)
	) {
		score += 40;
		factors.push("窗口函数");
	}

	// 7. Fuzzy search complexity
	if (input.sqlHints.fuzzyPatterns?.length) {
		score += 10;
		factors.push("模糊搜索");
		if (input.sqlHints.fuzzyPatterns.length > 2) {
			score += 10;
			factors.push("多个模糊条件");
		}
	}

	// 8. Vector search integration
	if (input.sqlHints.vectorIds?.length) {
		if (input.sqlHints.vectorIds.length > 100) {
			score += 15;
			factors.push("大量向量结果集成");
		} else {
			score += 5;
			factors.push("向量搜索集成");
		}
	}

	// 9. Query intent complexity
	const complexIntents =
		/排名|对比|趋势|变化|环比|同比|分析|correlation|ranking|comparison/i;
	if (input.query.match(complexIntents)) {
		score += 25;
		factors.push("复杂分析意图");
	}

	// 10. Natural language complexity
	if (input.query.length > 100) {
		score += 10;
		factors.push("复杂自然语言描述");
	}

	// Determine difficulty level with adjusted thresholds
	let level: "easy" | "hard" | "very_hard";
	if (score >= 80) {
		level = "very_hard";
	} else if (score >= 40) {
		level = "hard";
	} else {
		level = "easy";
	}

	return { level, factors, score };
}

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

			// Generate cache key
			const cacheKey = cacheManager.generateCacheKey("sql", {
				query: input.query,
				selectedTables: input.selectedTables.map((t) => ({
					name: t.tableName,
					fields: t.fields,
				})),
				sqlHints: {
					...input.sqlHints,
					vectorIds: input.sqlHints.vectorIds?.slice(0, 10), // Limit vector IDs in cache key
				},
			});

			// Check cache first
			const cached = await cacheManager.getSqlGeneration(cacheKey);
			if (cached) {
				console.log("[SQLBuilder] 使用缓存结果");
				return {
					success: true,
					result: cached,
					executionTime: Date.now() - startTime,
					cached: true,
					model: "Cached",
					difficulty: "cached",
				};
			}

			try {
				// Estimate query difficulty
				const difficulty = estimateQueryDifficulty(input);
				console.log("[SQLBuilder] 查询难度评估:", difficulty);

				// Initialize AI clients
				const anthropic = createAnthropic({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				// Select model based on difficulty
				let model: any;
				switch (difficulty.level) {
					case "easy":
						model = openai("gpt-4.1");
						console.log("[SQLBuilder] 使用 GPT-4.1 (快速模式)");
						break;
					case "hard":
						model = anthropic("claude-sonnet-4-20250514");
						console.log("[SQLBuilder] 使用 Claude Sonnet (精确模式)");
						break;
					case "very_hard":
						model = anthropic("claude-opus-4-20250514");
						console.log("[SQLBuilder] 使用 Claude Opus (高级推理模式)");
						break;
				}

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
					model,
					system: systemPrompt,
					prompt: "生成SQL语句",
					schema: SQLBuilderResultSchema,
					temperature: 0.1,
				});

				// Cache the result
				await cacheManager.setSqlGeneration(cacheKey, result);

				console.log("[SQLBuilder] SQL构建完成:", {
					sqlLength: result.sql.length,
					queryType: result.queryType,
					usesIndex: result.usesIndex,
					hasWarnings: result.warnings && result.warnings.length > 0,
					difficulty: difficulty.level,
					difficultyScore: difficulty.score,
					model:
						difficulty.level === "easy"
							? "GPT-4.1"
							: difficulty.level === "hard"
								? "Claude Sonnet"
								: "Claude Opus",
					executionTime: Date.now() - startTime,
				});

				return {
					success: true,
					result,
					executionTime: Date.now() - startTime,
					cached: false,
					model:
						difficulty.level === "easy"
							? "GPT-4.1"
							: difficulty.level === "hard"
								? "Claude Sonnet"
								: "Claude Opus",
					difficulty: difficulty.level,
				};
			} catch (error) {
				console.error("[SQLBuilder] 构建错误:", error);
				throw new Error("SQL构建失败");
			}
		}),
});
