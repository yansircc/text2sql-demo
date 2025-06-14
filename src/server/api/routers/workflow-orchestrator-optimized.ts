import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { queryContextManager } from "@/server/lib/query-context";
import { schemaRegistry } from "@/server/lib/schema-registry";
import { z } from "zod";

// Define the workflow result type
interface OptimizedWorkflowResult {
	queryId: string;
	status: "success" | "failed";
	strategy: "sql_only" | "vector_only" | "hybrid" | "rejected";
	data?: Array<Record<string, unknown>>;
	rowCount?: number;
	error?: string;
	metadata?: {
		totalTime: number;
		steps: string[];
		sql?: string;
		vectorSearchCount?: number;
		fusionMethod?: string;
	};
}

/**
 * Optimized Workflow Orchestrator
 *
 * Key optimizations:
 * 1. Schema passed by reference, not value
 * 2. Query context object reduces redundant data
 * 3. Aggressive parallelization in hybrid mode
 * 4. Streamlined data transformations
 */

// Lighter input schema - no full schema string
export const OptimizedWorkflowInputSchema = z.object({
	query: z.string(),
	schemaRef: z
		.object({
			schemaId: z.string(),
			version: z.string(),
		})
		.optional(), // Optional - will register if not provided
	databaseSchema: z.string().optional(), // Only needed if schemaRef not provided
	options: z
		.object({
			maxRows: z.number().default(100),
			timeout: z.number().default(30000),
			enableCache: z.boolean().default(true),
		})
		.optional(),
});

export const workflowOrchestratorOptimizedRouter = createTRPCRouter({
	executeOptimized: publicProcedure
		.input(OptimizedWorkflowInputSchema)
		.mutation(async ({ input, ctx }): Promise<OptimizedWorkflowResult> => {
			const startTime = Date.now();
			const { createCaller } = await import("@/server/api/root");
			const api = createCaller(ctx);

			// Step 1: Schema registration (if needed)
			let schemaRef = input.schemaRef;
			if (!schemaRef && input.databaseSchema) {
				schemaRef = schemaRegistry.register(input.databaseSchema);
			}

			if (!schemaRef) {
				throw new Error("No schema reference or schema provided");
			}

			// Step 2: Create query context
			const queryId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			const context = queryContextManager.create(queryId, input.query, {
				...schemaRef,
				timestamp: Date.now(),
			});

			try {
				// Step 3: Query analysis (only pass query and schema reference)
				console.log("[Optimized] Analyzing query with schema reference");
				const analysisResult = await api.queryAnalyzer?.analyze({
					query: input.query,
					databaseSchema: JSON.stringify({ schemaId: schemaRef.schemaId }), // Pass reference
					vectorizedFields: schemaRegistry.getSchema(schemaRef.schemaId)
						?.metadata?.vectorizedFields,
				});

				if (!analysisResult) {
					throw new Error("Query analyzer not available");
				}

				// Update context with analysis results
				queryContextManager.update(queryId, {
					routing: {
						strategy: analysisResult.analysis.routing.strategy,
						confidence: analysisResult.analysis.routing.confidence,
					},
					analysis: analysisResult.analysis,
				});

				// Step 4: Execute based on strategy
				const strategy = analysisResult.analysis.routing.strategy;

				if (strategy === "rejected") {
					return {
						queryId,
						status: "failed" as const,
						strategy: "rejected" as const,
						error: analysisResult.analysis.reason || "Query not feasible",
						metadata: {
							totalTime: Date.now() - startTime,
							steps: context.steps,
						},
					};
				}

				if (strategy === "vector_only") {
					// Direct vector search - no schema needed
					if (!analysisResult.analysis.vectorQueries) {
						throw new Error(
							"Vector queries not available for vector_only strategy",
						);
					}
					const queries = analysisResult.analysis.vectorQueries.map(
						(vq: any) => ({
							table: vq.table,
							fields: [vq.field],
							searchText: vq.query,
							searchType: "semantic" as const,
							weight: 1.0,
						}),
					);
					const vectorResult = await api.vectorSearch?.search({
						queries,
						hnswEf: 128,
					});

					if (!vectorResult) {
						throw new Error("Vector search not available");
					}

					return {
						queryId,
						status: "success" as const,
						strategy: "vector_only" as const,
						data: vectorResult.result.results.map((r: any) => ({
							...r.payload,
							_score: r.score,
							_matchedField: r.matchedField,
						})),
						rowCount: vectorResult.result.totalResults,
						metadata: {
							totalTime: Date.now() - startTime,
							steps: context.steps,
							vectorSearchCount: vectorResult.result.totalResults,
						},
					};
				}

				// SQL or Hybrid path - use parallel execution
				if (strategy === "sql_only" || strategy === "hybrid") {
					if (!analysisResult.analysis.sqlTables) {
						throw new Error(
							"SQL tables not available for sql_only/hybrid strategy",
						);
					}
					const tables = analysisResult.analysis.sqlTables;

					// Get filtered schema from registry
					const filteredSchema = schemaRegistry.getFilteredSchema(
						schemaRef.schemaId,
						tables,
					);

					// Parallel execution for hybrid mode
					if (strategy === "hybrid") {
						console.log(
							"[Optimized] Executing hybrid search with maximum parallelization",
						);

						// Execute ALL independent operations in parallel
						const [vectorResults, schemaSelection] = await Promise.all([
							// Vector search
							analysisResult.analysis.vectorQueries
								? api.vectorSearch.search({
										queries: analysisResult.analysis.vectorQueries.map(
											(vq: any) => ({
												table: vq.table,
												fields: [vq.field],
												searchText: vq.query,
												searchType: "semantic" as const,
												weight: 1.0,
											}),
										),
										hnswEf: 128,
									})
								: null,

							// Schema selection (with minimal data)
							api.schemaSelector.select({
								query: input.query,
								tables,
								databaseSchema: JSON.stringify(filteredSchema),
								vectorIds: undefined, // Will be added after if needed
							}),
						]);

						// Update vector context if we have results
						if (vectorResults) {
							queryContextManager.update(queryId, {
								vectorContext: {
									hasResults: vectorResults.result.results.length > 0,
									ids: vectorResults.result.results.map((r: any) => r.id),
									topMatches: vectorResults.result.results
										.slice(0, 5)
										.map((r: any) => ({
											id: r.id,
											score: r.score,
											matchedField: r.matchedField,
										})),
								},
							});
						}

						// SQL building with context
						// Transform schema selector result to SQL builder format
						const selectedTables = schemaSelection.result.tables.map(
							(tableName: string) => ({
								tableName,
								fields: schemaSelection.result.fields[tableName] || [],
								reason: "Selected by schema selector",
								isJoinTable: false,
							}),
						);

						// Transform join hints
						const joinHints = schemaSelection.result.joins
							?.map((joinStr: string) => {
								const match = joinStr.match(
									/(\w+)\s+(INNER|LEFT|RIGHT)\s+JOIN\s+(\w+)\s+ON\s+(.+)/i,
								);
								if (match && match[1] && match[2] && match[3] && match[4]) {
									return {
										from: match[1],
										type: match[2].toUpperCase() as "INNER" | "LEFT" | "RIGHT",
										to: match[3],
										on: match[4],
									};
								}
								return null;
							})
							.filter((x): x is NonNullable<typeof x> => x !== null);

						// Transform time field
						const timeFields = schemaSelection.result.timeField
							? [
									{
										table: schemaSelection.result.timeField.split(".")[0] || "",
										field:
											schemaSelection.result.timeField.split(".")[1] ||
											schemaSelection.result.timeField,
										dataType: "integer" as const,
										format: "timestamp" as const,
									},
								]
							: undefined;

						// Get the actual schema for selected tables
						const slimSchema: Record<string, any> = {};
						schemaSelection.result.tables.forEach((tableName: string) => {
							if (filteredSchema[tableName]) {
								slimSchema[tableName] = filteredSchema[tableName];
							}
						});

						const sqlBuildResult = await api.sqlBuilder.build({
							query: input.query,
							slimSchema: slimSchema,
							selectedTables,
							sqlHints: {
								joinHints,
								timeFields,
								vectorIds: context.vectorContext?.ids,
							},
						});

						// Execute SQL
						const sqlExecResult = await api.sqlExecutor.execute({
							sql: sqlBuildResult.result.sql,
							queryType: sqlBuildResult.result.queryType,
							maxRows: input.options?.maxRows || 100,
						});

						// Fusion if needed
						if (vectorResults) {
							const fusionResult = await api.resultFusion.fuse({
								userQuery: input.query,
								vectorResults: vectorResults.result.results,
								sqlResults: sqlExecResult.result.rows,
								maxResults: input.options?.maxRows || 100,
							});

							return {
								queryId,
								status: "success" as const,
								strategy: "hybrid" as const,
								data: fusionResult.results,
								rowCount: fusionResult.count,
								metadata: {
									totalTime: Date.now() - startTime,
									steps: context.steps,
									sql: sqlBuildResult.result.sql,
									vectorSearchCount: vectorResults.result.totalResults,
									fusionMethod: "ai_intelligent",
								},
							};
						}
					}

					// SQL-only path (simplified)
					const schemaSelection = await api.schemaSelector.select({
						query: input.query,
						tables,
						databaseSchema: JSON.stringify(filteredSchema),
						vectorIds: undefined,
					});

					// Transform schema selector result to SQL builder format
					const selectedTables2 = schemaSelection.result.tables.map(
						(tableName: string) => ({
							tableName,
							fields: schemaSelection.result.fields[tableName] || [],
							reason: "Selected by schema selector",
							isJoinTable: false,
						}),
					);

					// Transform join hints
					const joinHints2 = schemaSelection.result.joins
						?.map((joinStr: string) => {
							const match = joinStr.match(
								/(\w+)\s+(INNER|LEFT|RIGHT)\s+JOIN\s+(\w+)\s+ON\s+(.+)/i,
							);
							if (match && match[1] && match[2] && match[3] && match[4]) {
								return {
									from: match[1],
									type: match[2].toUpperCase() as "INNER" | "LEFT" | "RIGHT",
									to: match[3],
									on: match[4],
								};
							}
							return null;
						})
						.filter((x): x is NonNullable<typeof x> => x !== null);

					// Transform time field
					const timeFields2 = schemaSelection.result.timeField
						? [
								{
									table: schemaSelection.result.timeField.split(".")[0] || "",
									field:
										schemaSelection.result.timeField.split(".")[1] ||
										schemaSelection.result.timeField,
									dataType: "integer" as const,
									format: "timestamp" as const,
								},
							]
						: undefined;

					// Get the actual schema for selected tables
					const slimSchema2: Record<string, any> = {};
					schemaSelection.result.tables.forEach((tableName: string) => {
						if (filteredSchema[tableName]) {
							slimSchema2[tableName] = filteredSchema[tableName];
						}
					});

					const sqlBuildResult = await api.sqlBuilder.build({
						query: input.query,
						slimSchema: slimSchema2,
						selectedTables: selectedTables2,
						sqlHints: {
							joinHints: joinHints2,
							timeFields: timeFields2,
						},
					});

					const sqlExecResult = await api.sqlExecutor.execute({
						sql: sqlBuildResult.result.sql,
						queryType: sqlBuildResult.result.queryType,
						maxRows: input.options?.maxRows || 100,
					});

					return {
						queryId,
						status: "success" as const,
						strategy: "sql_only" as const,
						data: sqlExecResult.result.rows as Array<Record<string, unknown>>,
						rowCount: sqlExecResult.result.rowCount,
						metadata: {
							totalTime: Date.now() - startTime,
							steps: context.steps,
							sql: sqlBuildResult.result.sql,
						},
					};
				}

				// This should never be reached due to the strategy checks above
				throw new Error("Invalid routing strategy");
			} finally {
				// Cleanup old contexts periodically
				if (Math.random() < 0.1) {
					// 10% chance
					queryContextManager.cleanup();
				}
			}
		}),

	// Get current schema registry stats
	getSchemaStats: publicProcedure.query(() => {
		return {
			registeredSchemas: schemaRegistry.size(),
			// Note: In production, you'd expose context count differently
			// to avoid exposing internal structure
			activeContexts: 0,
		};
	}),
});
