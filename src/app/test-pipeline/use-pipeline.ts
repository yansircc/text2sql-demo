import { api } from "@/trpc/react";
import { useState } from "react";
import { DatabaseSchema, VectorizedDatabaseSchema } from "./constants";
import type { PipelineResults } from "./types";

export function usePipeline() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PipelineResults>({});

	// API mutations
	const preHandleMutation = api.preHandle.handleQuery.useMutation();
	const preSQLMutation = api.preSQL.generatePreSQL.useMutation();
	const slimSchemaMutation = api.preSQL.generateSlimSchema.useMutation();
	const genSQLMutation = api.genSQL.generateSQL.useMutation();
	const runSQLMutation = api.runSQL.runPipelineSQL.useMutation();

	// 步骤 1: Pre-Handle
	const handlePreHandle = async () => {
		try {
			const result = await preHandleMutation.mutateAsync({
				query,
				databaseSchema: DatabaseSchema,
				vectorizedDatabaseSchema: VectorizedDatabaseSchema,
			});
			setResults((prev) => ({ ...prev, preHandle: result }));
		} catch (error) {
			console.error("Pre-Handle 错误:", error);
			setResults((prev) => ({ ...prev, preHandle: { error: String(error) } }));
		}
	};

	// 步骤 2: Pre-SQL
	const handlePreSQL = async () => {
		try {
			const preHandleResult = results.preHandle?.result;
			const preHandleInfo = preHandleResult
				? JSON.stringify({
						semanticSearchResults: preHandleResult.semanticSearch
							.needsSemanticSearch
							? "[假设的语义搜索结果]"
							: null,
						selectedTables: preHandleResult.tableAnalysis.tables
							.filter((t: any) => t.confidence > 0.5) // 只选择置信度高的表
							.map((t: any) => t.tableName),
						hasJoins: preHandleResult.tableAnalysis.hasJoins,
					})
				: undefined;

			const result = await preSQLMutation.mutateAsync({
				naturalLanguageQuery: query,
				databaseSchema: DatabaseSchema,
				preHandleInfo,
			});
			setResults((prev) => ({ ...prev, preSQL: result }));
		} catch (error) {
			console.error("Pre-SQL 错误:", error);
			setResults((prev) => ({ ...prev, preSQL: { error: String(error) } }));
		}
	};

	// 步骤 3: 生成精简 Schema
	const handleSlimSchema = async () => {
		try {
			const preSQLResult = results.preSQL?.preSQL;
			if (!preSQLResult?.selectedTables) {
				throw new Error("Pre-SQL 结果中没有 selectedTables");
			}

			const result = await slimSchemaMutation.mutateAsync({
				selectedTables: preSQLResult.selectedTables,
				fullDatabaseSchema: DatabaseSchema,
			});
			setResults((prev) => ({ ...prev, slimSchema: result }));
		} catch (error) {
			console.error("Slim Schema 错误:", error);
			setResults((prev) => ({ ...prev, slimSchema: { error: String(error) } }));
		}
	};

	// 步骤 4: 生成 SQL
	const handleGenSQL = async () => {
		try {
			const preSQLResult = results.preSQL?.preSQL;
			const slimSchemaResult = results.slimSchema?.slimSchema;

			if (!preSQLResult || !slimSchemaResult) {
				throw new Error("缺少必要的前置步骤结果");
			}

			const result = await genSQLMutation.mutateAsync({
				preSQL: preSQLResult,
				slimSchema: JSON.stringify(slimSchemaResult),
			});
			setResults((prev) => ({ ...prev, genSQL: result }));
		} catch (error) {
			console.error("Gen SQL 错误:", error);
			setResults((prev) => ({ ...prev, genSQL: { error: String(error) } }));
		}
	};

	// 步骤 5: 执行 SQL
	const handleRunSQL = async () => {
		try {
			const genSQLResult = results.genSQL;

			if (!genSQLResult?.sql) {
				throw new Error("Gen SQL 结果中没有可执行的 SQL 语句");
			}

			const result = await runSQLMutation.mutateAsync({
				genSQLResult: {
					sql: genSQLResult.sql,
				},
				validate: true,
				readOnly: true, // 默认只读模式，确保安全
			});
			setResults((prev) => ({ ...prev, runSQL: result }));
		} catch (error) {
			console.error("Run SQL 错误:", error);
			setResults((prev) => ({ ...prev, runSQL: { error: String(error) } }));
		}
	};

	// 清除结果
	const clearResults = () => {
		setResults({});
	};

	// 一键运行全流程
	const runFullPipeline = async () => {
		try {
			clearResults();

			// Step 1: Pre-Handle
			const preHandleResult = await preHandleMutation.mutateAsync({
				query,
				databaseSchema: DatabaseSchema,
				vectorizedDatabaseSchema: VectorizedDatabaseSchema,
			});
			setResults((prev) => ({ ...prev, preHandle: preHandleResult }));

			// 检查是否需要继续
			const action = preHandleResult.result.decision.action;
			if (
				action === "not_feasible" ||
				action === "request_clarification" ||
				action === "too_many_tables" ||
				action === "vector_only" // 纯向量搜索直接返回结果
			) {
				console.log(
					"流程在 Pre-Handle 阶段停止:",
					preHandleResult.result.decision,
				);
				return;
			}

			// Step 2: Pre-SQL
			let preHandleInfo: string;
			let vectorSearchContext: any;

			if (action === "hybrid_search" && preHandleResult.hybridSearch) {
				// 混合搜索：包含向量搜索上下文
				preHandleInfo = JSON.stringify({
					selectedTables:
						preHandleResult.result.searchRequirement.sqlQuery?.tables || [],
					hybridMode: true,
				});
				vectorSearchContext = {
					hasVectorResults: true,
					companyIds: preHandleResult.hybridSearch.vectorResult.results.map(
						(r: any) => r.companyId,
					),
					summary: preHandleResult.hybridSearch.vectorResult.summary,
				};
			} else {
				// 纯SQL查询
				preHandleInfo = JSON.stringify({
					selectedTables:
						preHandleResult.result.searchRequirement.sqlQuery?.tables || [],
				});
			}

			const preSQLResult = await preSQLMutation.mutateAsync({
				naturalLanguageQuery: query,
				databaseSchema: DatabaseSchema,
				preHandleInfo,
				vectorSearchContext,
			});
			setResults((prev) => ({ ...prev, preSQL: preSQLResult }));

			// Step 3: Slim Schema
			const slimSchemaResult = await slimSchemaMutation.mutateAsync({
				selectedTables: preSQLResult.preSQL.selectedTables,
				fullDatabaseSchema: DatabaseSchema,
			});
			setResults((prev) => ({ ...prev, slimSchema: slimSchemaResult }));

			// Step 4: Gen SQL
			const genSQLResult = await genSQLMutation.mutateAsync({
				preSQL: preSQLResult.preSQL,
				slimSchema: JSON.stringify(slimSchemaResult.slimSchema),
			});
			setResults((prev) => ({ ...prev, genSQL: genSQLResult }));

			// Step 5: Run SQL (只在成功生成 SQL 后执行)
			if (genSQLResult.sql) {
				const runSQLResult = await runSQLMutation.mutateAsync({
					genSQLResult: {
						sql: genSQLResult.sql,
					},
					validate: true,
					readOnly: true,
				});
				setResults((prev) => ({ ...prev, runSQL: runSQLResult }));
			}
		} catch (error) {
			console.error("全流程执行错误:", error);
		}
	};

	return {
		query,
		setQuery,
		results,
		setResults,
		handlePreHandle,
		handlePreSQL,
		handleSlimSchema,
		handleGenSQL,
		handleRunSQL,
		clearResults,
		runFullPipeline,
	};
}
