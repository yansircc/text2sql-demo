import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import type { QueryAnalysis } from "./query-analyzer";
import type { ResultFusionResult } from "./result-fusion";
import type { SchemaSelectorResult } from "./schema-selector";
import type { SQLBuilderResult } from "./sql-builder";
import type { SQLExecutorResult } from "./sql-executor";
import type { VectorSearchResult } from "./vector-search";

/**
 * Workflow Orchestrator Router - CloudFlare Workflow主控制器
 *
 * 职责：编排整个查询处理流程
 * - 根据查询分析结果选择执行路径
 * - 协调各个步骤的执行
 * - 处理错误和重试
 * - 返回统一的结果格式
 *
 * 注意：这是一个简化的编排器示例
 * 在实际的CloudFlare Workflow中，每个步骤都会是独立的Worker
 */

// 工作流输入
export const WorkflowInputSchema = z.object({
	query: z.string(),
	databaseSchema: z.string(),
	vectorizedFields: z.record(z.array(z.string())).optional(),
	options: z
		.object({
			maxRows: z.number().default(100),
			timeout: z.number().default(30000),
			enableCache: z.boolean().default(false),
		})
		.optional(),
});

// 工作流结果
export const WorkflowResultSchema = z.object({
	queryId: z.string(),
	status: z.enum(["success", "partial", "failed"]),
	strategy: z.enum(["sql_only", "vector_only", "hybrid", "rejected"]),

	// 结果数据
	data: z.array(z.record(z.unknown())).optional(),
	rowCount: z.number().optional(),

	// 执行元数据
	metadata: z.object({
		totalTime: z.number(),
		steps: z.array(
			z.object({
				name: z.string(),
				status: z.enum(["success", "skipped", "failed"]),
				time: z.number(),
				error: z.string().optional(),
			}),
		),
		sql: z.string().optional(),
		vectorSearchCount: z.number().optional(),
		fusionMethod: z.string().optional(),
	}),

	// 错误信息
	error: z.string().optional(),
	suggestions: z.array(z.string()).optional(),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;

// 简化的工作流执行器
export const workflowOrchestratorRouter = createTRPCRouter({
	// 执行完整工作流
	execute: publicProcedure
		.input(WorkflowInputSchema)
		.mutation(async ({ input, ctx }): Promise<WorkflowResult> => {
			// 动态导入以避免循环依赖
			const { createCaller } = await import("@/server/api/root");
			const api = createCaller(ctx);

			const startTime = Date.now();
			const steps: Array<{
				name: string;
				status: "success" | "skipped" | "failed";
				time: number;
				error?: string;
			}> = [];

			console.log("[Workflow] 开始执行查询工作流:", input.query);

			let queryId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			let finalStrategy: "sql_only" | "vector_only" | "hybrid" | "rejected" =
				"rejected";
			let finalData: Array<Record<string, unknown>> = [];
			let rowCount = 0;
			let generatedSql: string | undefined;
			let vectorSearchCount: number | undefined;
			let fusionMethod: string | undefined;

			try {
				// Step 1: 查询分析
				const analysisStartTime = Date.now();
				console.log("[Workflow] Step 1: 查询分析");

				const analysisResult: {
					success: boolean;
					analysis: QueryAnalysis;
					executionTime: number;
				} = await api.queryAnalyzer.analyze({
					query: input.query,
					databaseSchema: input.databaseSchema,
					vectorizedFields: input.vectorizedFields,
				});

				const analysisTime = Date.now() - analysisStartTime;
				steps.push({
					name: "QueryAnalysis",
					status: "success",
					time: analysisTime,
				});

				const analysis = analysisResult.analysis;
				queryId = analysis.queryId;
				finalStrategy = analysis.routing.strategy;

				// 检查是否被拒绝
				if (
					analysis.routing.strategy === "rejected" ||
					!analysis.feasibility.isFeasible
				) {
					console.log("[Workflow] 查询被拒绝:", analysis.feasibility.reason);
					return {
						queryId,
						status: "failed" as const,
						strategy: "rejected" as const,
						error: analysis.feasibility.reason || "查询不可行",
						suggestions: analysis.feasibility.suggestedAlternatives,
						metadata: {
							totalTime: Date.now() - startTime,
							steps,
						},
					};
				}

				// 根据路由策略执行不同流程
				if (analysis.routing.strategy === "vector_only") {
					// Vector Only Flow
					console.log("[Workflow] 执行向量搜索流程");

					if (analysis.vectorConfig) {
						const vectorStartTime = Date.now();
						const vectorResult = await api.vectorSearch.search({
							queries: analysis.vectorConfig.queries,
							hnswEf: 128,
						});

						steps.push({
							name: "VectorSearch",
							status: "success",
							time: Date.now() - vectorStartTime,
						});

						// 转换向量搜索结果为最终数据格式
						finalData = vectorResult.result.results.map(
							(r: {
								payload: Record<string, unknown>;
								score: number;
								matchedField: string;
							}) => ({
								...r.payload,
								_score: r.score,
								_matchedField: r.matchedField,
							}),
						);
						rowCount = vectorResult.result.totalResults;
						vectorSearchCount = vectorResult.result.totalResults;
					}
				} else if (
					analysis.routing.strategy === "sql_only" ||
					analysis.routing.strategy === "hybrid"
				) {
					// SQL Flow 或 Hybrid Flow
					let vectorContext: any = undefined;
					let vectorResults: any = undefined;

					// 如果是 hybrid，先执行向量搜索
					if (analysis.routing.strategy === "hybrid" && analysis.vectorConfig) {
						console.log("[Workflow] 执行混合搜索 - 向量搜索部分");
						const vectorStartTime = Date.now();

						const vectorResult = await api.vectorSearch.search({
							queries: analysis.vectorConfig.queries,
							hnswEf: 128,
						});

						steps.push({
							name: "VectorSearch",
							status: "success",
							time: Date.now() - vectorStartTime,
						});

						vectorResults = vectorResult.result;
						vectorSearchCount = vectorResult.result.totalResults;

						// 准备向量上下文供 SQL 部分使用
						vectorContext = {
							hasResults: vectorResult.result.results.length > 0,
							ids: vectorResult.result.results.map((r: { id: number }) => r.id),
							topMatches: vectorResult.result.results.slice(0, 5).map(
								(r: {
									id: number;
									score: number;
									matchedField: string;
								}) => ({
									id: r.id,
									score: r.score,
									matchedField: r.matchedField,
								}),
							),
						};
					}

					// Step 2B: Schema 选择
					if (analysis.sqlConfig) {
						console.log("[Workflow] Step 2B: Schema选择");
						const schemaStartTime = Date.now();

						// 解析完整 schema
						const fullSchema = JSON.parse(input.databaseSchema);

						// 只提取 query-analyzer 选择的表的 schema
						const filteredSchema: Record<string, any> = {};
						analysis.sqlConfig.tables.forEach((tableName) => {
							if (fullSchema[tableName]) {
								filteredSchema[tableName] = fullSchema[tableName];
							}
						});

						const schemaResult = await api.schemaSelector.select({
							query: input.query,
							sqlConfig: analysis.sqlConfig,
							fullSchema: JSON.stringify(filteredSchema), // 只传递需要的表
							vectorContext,
						});

						steps.push({
							name: "SchemaSelection",
							status: "success",
							time: Date.now() - schemaStartTime,
						});

						// Step 3: SQL 构建
						console.log("[Workflow] Step 3: SQL构建");
						const sqlBuildStartTime = Date.now();

						const sqlBuildResult = await api.sqlBuilder.build({
							query: input.query,
							slimSchema: schemaResult.result.slimSchema,
							selectedTables: schemaResult.result.selectedTables,
							sqlHints: {
								...schemaResult.result.sqlHints,
								vectorIds: vectorContext?.ids,
							},
						});

						steps.push({
							name: "SQLBuilding",
							status: "success",
							time: Date.now() - sqlBuildStartTime,
						});

						generatedSql = sqlBuildResult.result.sql;

						// Step 4: SQL 执行
						console.log("[Workflow] Step 4: SQL执行");
						const sqlExecStartTime = Date.now();

						const sqlExecResult = await api.sqlExecutor.execute({
							sql: sqlBuildResult.result.sql,
							queryType: sqlBuildResult.result.queryType,
							maxRows: input.options?.maxRows || 100,
						});

						steps.push({
							name: "SQLExecution",
							status: "success",
							time: Date.now() - sqlExecStartTime,
						});

						// 如果是 hybrid，需要融合结果
						if (analysis.routing.strategy === "hybrid" && vectorResults) {
							console.log("[Workflow] Step 5: 结果融合");
							const fusionStartTime = Date.now();

							const fusionResult = await api.resultFusion.fuse({
								userQuery: input.query,
								vectorResults: vectorResults.results,
								sqlResults: sqlExecResult.result.rows,
								maxResults: input.options?.maxRows || 100,
							});

							steps.push({
								name: "ResultFusion",
								status: "success",
								time: Date.now() - fusionStartTime,
							});

							// 使用AI融合的结果
							finalData = fusionResult.results as Array<
								Record<string, unknown>
							>;
							rowCount = fusionResult.count;
							fusionMethod = "ai_intelligent";
						} else {
							// 纯 SQL 结果
							finalData = sqlExecResult.result.rows as Array<
								Record<string, unknown>
							>;
							rowCount = sqlExecResult.result.rowCount;
						}
					}
				}

				console.log("[Workflow] 工作流执行完成:", {
					queryId,
					strategy: finalStrategy,
					rowCount,
					totalTime: Date.now() - startTime,
				});

				return {
					queryId,
					status: "success" as const,
					strategy: finalStrategy,
					data: finalData,
					rowCount,
					metadata: {
						totalTime: Date.now() - startTime,
						steps,
						sql: generatedSql,
						vectorSearchCount,
						fusionMethod,
					},
				};
			} catch (error) {
				console.error("[Workflow] 工作流执行失败:", error);

				// 添加失败步骤（如果有的话）
				const errorMessage =
					error instanceof Error ? error.message : "未知错误";

				if (steps.length > 0) {
					// 找到最后一个成功的步骤
					const lastStep = steps[steps.length - 1];
					if (lastStep) {
						steps.push({
							name: "Unknown",
							status: "failed",
							time: 0,
							error: errorMessage,
						});
					}
				}

				return {
					queryId,
					status: "failed" as const,
					strategy: finalStrategy,
					error: errorMessage,
					metadata: {
						totalTime: Date.now() - startTime,
						steps,
					},
				};
			}
		}),

	// 获取工作流定义（用于可视化和文档）
	getDefinition: publicProcedure.query(() => {
		return {
			name: "Text2SQL Workflow",
			version: "2.0.0",
			description: "将自然语言查询转换为SQL并执行的工作流",

			// 定义所有可能的步骤
			steps: [
				{
					id: "query-analysis",
					name: "查询分析",
					description: "分析查询意图并决定路由策略",
					inputs: ["query", "databaseSchema", "vectorizedFields"],
					outputs: ["routing", "sqlConfig", "vectorConfig"],
					router: "queryAnalyzer.analyze",
				},
				{
					id: "vector-search",
					name: "向量搜索",
					description: "执行语义向量搜索",
					condition:
						"routing.strategy === 'vector_only' || routing.strategy === 'hybrid'",
					inputs: ["vectorConfig"],
					outputs: ["vectorResults"],
					router: "vectorSearch.search",
				},
				{
					id: "schema-selection",
					name: "Schema选择",
					description: "选择相关的表和字段",
					condition:
						"routing.strategy === 'sql_only' || routing.strategy === 'hybrid'",
					inputs: ["sqlConfig", "vectorContext?"],
					outputs: ["selectedSchema", "sqlHints"],
					router: "schemaSelector.select",
				},
				{
					id: "sql-building",
					name: "SQL构建",
					description: "生成优化的SQL语句",
					condition:
						"routing.strategy === 'sql_only' || routing.strategy === 'hybrid'",
					inputs: ["selectedSchema", "sqlHints", "vectorIds?"],
					outputs: ["sql", "queryType"],
					router: "sqlBuilder.build",
				},
				{
					id: "sql-execution",
					name: "SQL执行",
					description: "执行SQL查询",
					condition:
						"routing.strategy === 'sql_only' || routing.strategy === 'hybrid'",
					inputs: ["sql", "queryType"],
					outputs: ["sqlResults"],
					router: "sqlExecutor.execute",
				},
				{
					id: "result-fusion",
					name: "结果融合",
					description: "融合向量搜索和SQL查询结果",
					condition: "routing.strategy === 'hybrid'",
					inputs: ["vectorResults", "sqlResults", "fusionConfig"],
					outputs: ["fusedResults"],
					router: "resultFusion.fuse",
				},
			],

			// 定义不同策略的执行流程
			flows: [
				{
					name: "SQL Only Flow",
					strategy: "sql_only",
					steps: [
						"query-analysis",
						"schema-selection",
						"sql-building",
						"sql-execution",
					],
				},
				{
					name: "Vector Only Flow",
					strategy: "vector_only",
					steps: ["query-analysis", "vector-search"],
				},
				{
					name: "Hybrid Flow",
					strategy: "hybrid",
					steps: [
						"query-analysis",
						"vector-search",
						"schema-selection",
						"sql-building",
						"sql-execution",
						"result-fusion",
					],
					parallelGroups: [
						["vector-search", "schema-selection"], // 这两个可以并行执行
					],
				},
			],

			// CloudFlare Workflow 配置建议
			deployment: {
				platform: "CloudFlare Workers",
				features: [
					"Durable Objects for state management",
					"Workers KV for caching",
					"Queues for async processing",
					"Analytics Engine for monitoring",
				],
				scalability: {
					maxConcurrency: 1000,
					timeout: 30000,
					memory: 128,
				},
			},
		};
	}),

	// 获取工作流执行状态（示例）
	getStatus: publicProcedure
		.input(
			z.object({
				queryId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			// 在实际实现中，这里会查询Durable Object或KV存储
			console.log("[Workflow] 查询状态:", input.queryId);

			return {
				queryId: input.queryId,
				status: "completed",
				startTime: new Date().toISOString(),
				endTime: new Date().toISOString(),
				steps: [
					{
						name: "QueryAnalysis",
						status: "success" as const,
						startTime: new Date().toISOString(),
						endTime: new Date().toISOString(),
						duration: 150,
					},
				],
			};
		}),
});
