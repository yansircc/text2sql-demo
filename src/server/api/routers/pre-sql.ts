import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// 表字段选择 Schema
const TableFieldSelection = z.object({
	tableName: z.string().describe("表名，必须是数据库中实际存在的表名"),
	fields: z
		.array(z.string())
		.describe("需要的字段列表，必须是该表中实际存在的字段名"),
	reason: z.string().describe("选择该表和字段的原因"),
});

// 简化的 PreSQL Schema - 只保留核心信息
export const PreSQLSchema = z.object({
	// 1. 难易程度推断
	difficulty: z
		.enum(["simple", "medium", "hard"])
		.describe("查询难易程度：simple(简单), medium(中等), hard(困难)"),
	difficultyReason: z.string().describe("难易程度判断的原因，用自然语言描述"),

	// 2. 涉及的表和字段
	tablesAndFields: z
		.string()
		.describe(
			"需要用到哪些表和字段，用自然语言描述，例如：'需要用户表的姓名和邮箱字段，订单表的金额和时间字段'",
		),

	// 2.1 结构化的表和字段选择（新增，用于后续 gen-sql）
	selectedTables: z
		.array(TableFieldSelection)
		.describe("精确选择的表和字段列表，用于生成 SQL 时的 schema 精简"),

	// 3. 分析推理步骤
	analysisSteps: z
		.array(z.string())
		.describe("逻辑分析步骤，每个步骤用一句自然语言描述"),

	// 4. 时间范围
	timeRange: z
		.string()
		.optional()
		.describe(
			"时间范围的自然语言描述，例如：'今天'、'上周到本周'、'2023年1月之前'等，如果没有时间限制则为空",
		),

	// 5. 是否需要语义搜索
	needsSemanticSearch: z
		.boolean()
		.describe("是否需要语义搜索来补充查询，true或false"),

	// 6. 查询类型
	queryType: z
		.string()
		.describe(
			"查询类型的自然语言描述，例如：'统计查询'、'详细列表查询'、'关联查询'等",
		),

	// 9. SQL 生成提示（新增）
	sqlHints: z
		.object({
			// 排序需求
			orderBy: z
				.array(
					z.object({
						field: z.string().describe("排序字段"),
						direction: z.enum(["ASC", "DESC"]).describe("排序方向"),
					}),
				)
				.optional()
				.describe("排序要求，如果有的话"),

			// 分组需求
			groupBy: z
				.array(z.string())
				.optional()
				.describe("分组字段，如果需要分组的话"),

			// 限制数量
			limit: z.number().optional().describe("结果数量限制，如果有的话"),

			// 聚合函数
			aggregations: z
				.array(
					z.object({
						function: z
							.enum(["COUNT", "SUM", "AVG", "MAX", "MIN"])
							.describe("聚合函数"),
						field: z.string().describe("聚合字段"),
						alias: z.string().optional().describe("别名"),
					}),
				)
				.optional()
				.describe("需要的聚合函数"),

			// JOIN 提示
			joins: z
				.array(
					z.object({
						type: z
							.enum(["INNER", "LEFT", "RIGHT", "FULL"])
							.describe("JOIN 类型"),
						fromTable: z.string().describe("源表"),
						toTable: z.string().describe("目标表"),
						condition: z
							.string()
							.describe("JOIN 条件描述，如：'通过 companyId 关联'"),
					}),
				)
				.optional()
				.describe("表之间的关联关系"),

			// 特殊条件
			specialConditions: z
				.array(z.string())
				.optional()
				.describe("特殊的 WHERE 条件，如：'只要激活的用户'、'排除测试数据'等"),

			// 时间字段处理提示
			timeFieldHints: z
				.array(
					z.object({
						field: z.string().describe("时间字段名"),
						dataType: z
							.enum(["integer", "text", "real"])
							.describe(
								"数据库中的存储类型：integer(Unix时间戳), text(ISO字符串), real(浮点时间戳)",
							),
						format: z
							.enum(["timestamp", "datetime", "date"])
							.describe(
								"时间格式：timestamp(Unix时间戳), datetime(日期时间), date(仅日期)",
							),
						timezone: z.string().optional().describe("时区信息"),
						sqlCastFunction: z
							.string()
							.optional()
							.describe(
								"SQL中需要的类型转换函数模板，如：'CAST(strftime(...) AS INTEGER)', 'datetime(...)', 'CAST(strftime(...) AS REAL)' 等",
							),
					}),
				)
				.optional()
				.describe("时间字段的详细类型信息和SQL处理方式"),

			// 是否需要去重
			distinct: z.boolean().optional().describe("是否需要 DISTINCT 去重"),
		})
		.optional()
		.describe("SQL 生成的具体提示和要求"),
});

export type PreSQL = z.infer<typeof PreSQLSchema>;

export const preSQLRouter = createTRPCRouter({
	// 生成简化的 presql
	generatePreSQL: publicProcedure
		.input(
			z.object({
				naturalLanguageQuery: z
					.string()
					.min(1, "查询不能为空")
					.describe("用户的自然语言查询"),
				databaseSchema: z.string().describe("数据库schema的JSON字符串"),
				context: z.string().optional().describe("额外的上下文信息"),
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

				const systemPrompt = `你是一个数据库查询分析师。将用户的自然语言查询转换为结构化的预SQL分析。

当前时间: ${currentTime}
数据库Schema: ${input.databaseSchema}
上下文: ${input.context || "无"}

请基于schema元数据智能分析用户查询，生成精准的分析报告：

1. 判断查询难易程度（2张表以下=简单，3-5张表=中等，5张表以上=困难）
2. 用自然语言描述需要哪些表和字段
3. **重要：智能选择表和字段**，基于schema元数据和业务语义：
   - 优先选择有完整约束（required、有默认值）的字段
   - 根据字段描述匹配查询需求
   - 考虑字段间的逻辑关系和数据完整性
4. 列出逻辑分析步骤（每步一句话）
5. 识别时间范围（如果有的话）
6. 判断是否需要语义搜索（模糊匹配、相似性搜索等）
7. 描述查询类型
8. 指出可能的风险或注意事项
9. 评估分析的信心度
10. **重要：生成 SQL 提示（sqlHints）**，包括：
    - 排序需求（orderBy）：如果查询提到"最新"、"最早"、"按...排序"等
    - 分组需求（groupBy）：如果需要"按...分组"、"每个..."等
    - 数量限制（limit）：如果提到"前10个"、"最多20条"等
    - 聚合函数（aggregations）：如果需要"总数"、"平均值"、"最大值"等
    - 表关联（joins）：多表查询时的关联方式和条件
    - 特殊条件（specialConditions）：如"活跃的"、"未删除的"等业务条件
    - 时间字段提示（timeFieldHints）：分析涉及的时间字段，推断存储类型和SQL处理方式
    - 去重需求（distinct）：如果需要"唯一的"、"不重复的"等

**核心原则**：
- 基于提供的schema严格选择存在的表名和字段名
- 利用schema中的元数据（type、description、required等）做出最佳判断
- **时间字段分析原则**：根据schema元数据自主判断：
  * 分析字段的 type (number/string)、description、required 状态
  * 根据 type + description 推断存储格式（timestamp/datetime/date）
  * 考虑字段的完整性（required字段通常比optional更可靠）
- 在 timeFieldHints 中必须提供：dataType(存储类型)、format(时间格式)、sqlCastFunction(SQL转换函数)
- **SQL转换函数自动推断**：根据分析的存储类型自动选择：
  * 数值类型 + 时间戳语义 → "CAST(strftime(...) AS INTEGER/REAL)"
  * 字符串类型 + 时间语义 → "datetime(...)" 或 "strftime(...)"
  * 转换函数应为模板形式，使用占位符表示具体时间表达式
- 分析用户查询的隐含需求，如"今天新增的客户"可能需要按时间倒序排列
- 对于列表查询，考虑是否需要添加默认的数量限制

**分析要求**：
- 充分理解schema结构和字段语义
- 基于元数据做出最优的字段选择决策  
- 生成准确的时间处理策略
- 保持分析结果的通用性和可扩展性

使用自然语言描述，避免过度技术化的表达。`;

				const { object: preSQL } = await generateObject({
					model: openai("gpt-4.1"),
					// model: anthropic("claude-sonnet-4-20250514"),
					system: systemPrompt,
					prompt: `请分析这个查询：\n\n"${input.naturalLanguageQuery}"\n\n生成简化的presql分析，特别注意精确选择需要的表和字段。`,
					schema: PreSQLSchema,
					temperature: 0.1,
				});

				return {
					success: true,
					preSQL,
					rawQuery: input.naturalLanguageQuery,
					processingTime: new Date().toISOString(),
				};
			} catch (error) {
				console.error("PreSQL 生成错误:", error);
				throw new Error("PreSQL 分析服务暂时不可用，请稍后再试");
			}
		}),

	// 根据 presql 生成精简的数据库 schema
	generateSlimSchema: publicProcedure
		.input(
			z.object({
				selectedTables: z.array(TableFieldSelection).describe("精选的表和字段"),
				fullDatabaseSchema: z
					.string()
					.describe("完整的数据库schema JSON字符串"),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// 解析完整的数据库 schema
				const fullSchema = JSON.parse(input.fullDatabaseSchema);

				// 构建精简的 schema，保留 description 信息
				const slimSchema: Record<string, any> = {};

				for (const tableSelection of input.selectedTables) {
					const { tableName, fields } = tableSelection;

					// 检查表是否存在
					if (fullSchema[tableName]) {
						const tableSchema = fullSchema[tableName];

						// 创建精简的表 schema
						slimSchema[tableName] = {
							...tableSchema,
							properties: {},
						};

						// 只保留选中的字段
						if (tableSchema.properties) {
							for (const field of fields) {
								if (tableSchema.properties[field]) {
									// 完整复制字段定义，包括 description
									slimSchema[tableName].properties[field] =
										tableSchema.properties[field];
								}
							}
						}

						// 更新 required 字段列表，只保留选中的字段
						if (tableSchema.required) {
							slimSchema[tableName].required = tableSchema.required.filter(
								(field: string) => fields.includes(field),
							);
						}
					}
				}

				return {
					success: true,
					slimSchema,
					originalTableCount: Object.keys(fullSchema).length,
					slimTableCount: Object.keys(slimSchema).length,
					compressionRatio:
						Object.keys(slimSchema).length / Object.keys(fullSchema).length,
				};
			} catch (error) {
				console.error("精简Schema生成错误:", error);
				throw new Error("精简Schema生成失败，请检查输入数据");
			}
		}),

	// 获取简化的schema定义
	getPreSQLSchema: publicProcedure.query(() => {
		return {
			schema: PreSQLSchema,
			version: "2.1.0-with-table-selection",
			description:
				"简化版 PreSQL 分析结果的数据结构定义，包含表和字段精确选择功能",
		};
	}),
});
