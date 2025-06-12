import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * Pre-SQL Router
 *
 * 职责：基于预选的表，生成 SQL 构建所需的精确信息
 *
 * 输入：
 * - 用户查询
 * - 预选的表列表（来自 pre-handle）
 * - 仅包含相关表的 schema（减少上下文）
 *
 * 主要功能：
 * 1. 从预选的表中选择必要的字段
 * 2. 生成 SQL 构建步骤
 * 3. 处理时间范围
 * 4. 生成 SQL 提示（排序、分组、聚合等）
 *
 * 输出：
 * - 精确的表和字段选择
 * - SQL 生成提示
 * - 用于后续 SQL 生成的结构化信息
 */

// 表字段选择 Schema
const TableFieldSelection = z.object({
	tableName: z.string().describe("表名，必须是数据库中实际存在的表名"),
	fields: z
		.array(z.string())
		.describe("需要的字段列表，必须是该表中实际存在的字段名"),
	reason: z.string().describe("选择该表和字段的原因"),
});

// 简化的 PreSQL Schema - 专注于 SQL 生成
export const PreSQLSchema = z.object({
	// 结构化的表和字段选择
	selectedTables: z
		.array(TableFieldSelection)
		.describe("精确选择的表和字段列表，用于生成 SQL 时的 schema 精简"),

	// 分析推理步骤
	analysisSteps: z
		.array(z.string())
		.describe("SQL 生成的逻辑步骤，每个步骤用一句话描述"),

	// 时间范围
	timeRange: z
		.string()
		.optional()
		.describe(
			"时间范围的具体描述，例如：'2024-01-01 到 2024-01-31'，如果没有时间限制则为空",
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
			limit: z
				.number()
				.nullable()
				.optional()
				.describe("结果数量限制，如果有的话"),

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
				preHandleInfo: z.string().optional().describe("预处理阶段的信息"),
				vectorSearchContext: z
					.object({
						hasVectorResults: z.boolean().describe("是否有向量搜索结果"),
						companyIds: z
							.array(z.number())
							.optional()
							.describe("向量搜索返回的公司ID列表"),
						summary: z.string().optional().describe("向量搜索结果摘要"),
					})
					.optional()
					.describe("向量搜索的上下文信息（用于混合搜索）"),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				console.log(
					"[PreSQL] 开始生成PreSQL，查询:",
					input.naturalLanguageQuery,
				);

				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});

				const currentTime = new Date().toISOString();

				// 解析预处理信息，获取预选的表
				let selectedTablesSchema = input.databaseSchema;
				if (input.preHandleInfo) {
					try {
						const preHandleData = JSON.parse(input.preHandleInfo);
						if (
							preHandleData.selectedTables &&
							preHandleData.selectedTables.length > 0
						) {
							console.log(
								"[PreSQL] 使用预选的表:",
								preHandleData.selectedTables,
							);
							// 只保留预选的表的 schema
							const fullSchema = JSON.parse(input.databaseSchema);
							const filteredSchema: Record<string, any> = {};

							for (const tableName of preHandleData.selectedTables) {
								if (fullSchema[tableName]) {
									filteredSchema[tableName] = fullSchema[tableName];
								}
							}

							selectedTablesSchema = JSON.stringify(filteredSchema);
						}
					} catch (e) {
						console.warn("解析预处理信息失败，使用完整 schema", e);
					}
				}

				// 构建向量搜索上下文信息
				let vectorContextPrompt = "";
				if (input.vectorSearchContext?.hasVectorResults) {
					console.log("[PreSQL] 包含向量搜索上下文:", {
						companyCount: input.vectorSearchContext.companyIds?.length || 0,
						hasIds: !!input.vectorSearchContext.companyIds,
					});

					vectorContextPrompt = `

**向量搜索上下文**：
- 已经执行了语义向量搜索
- 找到了 ${input.vectorSearchContext.companyIds?.length || 0} 个相关公司
- 公司ID列表: ${input.vectorSearchContext.companyIds?.join(", ") || "无"}
${input.vectorSearchContext.summary ? `- 摘要: ${input.vectorSearchContext.summary}` : ""}

对于混合搜索场景，你可以：
1. 使用这些公司ID作为 WHERE IN 条件的一部分
2. 或者将向量搜索结果作为子查询或CTE的输入
3. 考虑使用 CASE WHEN 给向量搜索匹配的记录更高的权重`;
				}

				const systemPrompt = `你是一个SQL生成专家。基于预处理结果和数据库schema，准备SQL生成所需的精确信息。

当前时间: ${currentTime}
数据库Schema（仅包含相关表）: ${selectedTablesSchema}
上下文: ${input.context || "无"}
预处理信息: ${input.preHandleInfo || "无"}${vectorContextPrompt}

**2025年最佳实践原则**：
1. **优先使用SQL模糊查询**：
   - 如果查询包含明确的关键词，优先使用 LIKE '%keyword%' 或 GLOB 模式
   - SQLite支持的模糊查询：LIKE, GLOB, REGEXP (需要扩展)
   - 示例：查找"包含AI的公司" → WHERE name LIKE '%AI%' OR products LIKE '%AI%'
   
2. **合理使用混合搜索结果**：
   - 如果有向量搜索结果的公司ID，可以作为过滤条件
   - 但不要完全依赖向量搜索结果，SQL查询应该独立完整
   - 示例：WHERE id IN (向量搜索结果) OR (其他SQL条件)

3. **智能字段选择**：
   - 只选择查询真正需要的字段
   - 对于文本搜索，优先选择已建立索引的字段

请生成精简的SQL生成准备信息：

1. **精确选择表和字段**：
   - 基于查询需求，从给定的表中选择必要的字段
   - 严格匹配schema中存在的表名和字段名
   - 说明是否可以通过SQL模糊查询解决

2. **分析步骤**：
   - 简洁描述SQL构建的逻辑步骤
   - 明确指出哪些可以用LIKE解决，哪些需要精确匹配

3. **时间处理**：
   - 将自然语言时间转换为具体时间范围
   - 识别时间字段的存储格式

4. **SQL提示生成**：
   - 生成具体的模糊查询模式
   - 如果有向量搜索结果，说明如何整合
   - 包含必要的排序、分组、聚合等信息

**核心要求**：
- 优先考虑SQL模糊查询而非向量搜索
- 明确标识哪些条件可以用LIKE/GLOB解决
- 如果是混合搜索，合理整合向量搜索结果
- 保持SQL查询的独立性和完整性`;

				const { object: preSQL } = await generateObject({
					model: openai("gpt-4.1"),
					system: systemPrompt,
					prompt: `请分析这个查询：\n\n"${input.naturalLanguageQuery}"\n\n生成SQL准备信息。`,
					schema: PreSQLSchema,
					temperature: 0.1,
				});

				console.log("[PreSQL] AI分析完成:", {
					selectedTables: preSQL.selectedTables.length,
					tables: preSQL.selectedTables.map((t) => t.tableName),
					hasTimeRange: !!preSQL.timeRange,
					hasSQLHints: !!preSQL.sqlHints,
					hintsOrderBy: preSQL.sqlHints?.orderBy?.length || 0,
					hintsAggregations: preSQL.sqlHints?.aggregations?.length || 0,
				});

				// 如果有模糊查询提示，添加到SQL hints中
				if (preSQL.sqlHints && input.preHandleInfo) {
					try {
						const preHandleData = JSON.parse(input.preHandleInfo);
						if (
							preHandleData.searchRequirement?.sqlQuery?.fuzzySearchPatterns
						) {
							preSQL.sqlHints.specialConditions = [
								...(preSQL.sqlHints.specialConditions || []),
								...preHandleData.searchRequirement.sqlQuery.fuzzySearchPatterns.map(
									(pattern: string) => `使用模糊查询: ${pattern}`,
								),
							];
						}
					} catch (e) {
						// 忽略解析错误
					}
				}

				return {
					success: true,
					preSQL,
					rawQuery: input.naturalLanguageQuery,
					processingTime: new Date().toISOString(),
					hasVectorContext: !!input.vectorSearchContext?.hasVectorResults,
					tablesUsed: (() => {
						if (selectedTablesSchema === input.databaseSchema) {
							console.log("[PreSQL] 使用完整schema");
							return "all";
						}
						try {
							const schema = JSON.parse(selectedTablesSchema);
							const tables = Object.keys(schema);
							console.log("[PreSQL] 使用精简schema，表数:", tables.length);
							return tables;
						} catch {
							return [];
						}
					})(),
				};
			} catch (error) {
				console.error("[PreSQL] 生成错误:", error);
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
			version: "3.0.0-simplified",
			description: "精简版 PreSQL - 专注于SQL生成准备",
		};
	}),
});
