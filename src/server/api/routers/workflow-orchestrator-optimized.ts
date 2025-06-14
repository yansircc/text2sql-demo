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
						error: analysisResult.analysis.feasibility.reason,
						metadata: {
							totalTime: Date.now() - startTime,
							steps: context.steps,
						},
					};
				}

				if (strategy === "vector_only") {
					// Direct vector search - no schema needed
					const vectorResult = await api.vectorSearch?.search({
						queries: analysisResult.analysis.vectorConfig!.queries,
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
					const sqlConfig = analysisResult.analysis.sqlConfig!;
					const tables = sqlConfig.tables;

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
							analysisResult.analysis.vectorConfig
								? api.vectorSearch.search({
										queries: analysisResult.analysis.vectorConfig.queries,
										hnswEf: 128,
									})
								: null,

							// Schema selection (with minimal data)
							api.schemaSelector.select({
								query: input.query,
								sqlConfig,
								fullSchema: JSON.stringify(filteredSchema),
								vectorContext: undefined, // Will be added after if needed
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
						const sqlBuildResult = await api.sqlBuilder.build({
							query: input.query,
							slimSchema: schemaSelection.result.slimSchema,
							selectedTables: schemaSelection.result.selectedTables,
							sqlHints: {
								...schemaSelection.result.sqlHints,
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
						sqlConfig,
						fullSchema: JSON.stringify(filteredSchema),
						vectorContext: undefined,
					});

					const sqlBuildResult = await api.sqlBuilder.build({
						query: input.query,
						slimSchema: schemaSelection.result.slimSchema,
						selectedTables: schemaSelection.result.selectedTables,
						sqlHints: schemaSelection.result.sqlHints,
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
