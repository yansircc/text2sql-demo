import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

/**
 * Pipeline Comparison Router
 *
 * Compare original vs simplified pipeline:
 * - Execution time
 * - Token usage
 * - Output complexity
 * - Result accuracy
 */

export const pipelineComparisonRouter = createTRPCRouter({
	compareFullPipeline: publicProcedure
		.input(
			z.object({
				query: z.string(),
				databaseSchema: z.string(),
				vectorizedFields: z.record(z.array(z.string())).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const startTotal = Date.now();

			// Sample schema for testing
			const testSchema =
				input.databaseSchema ||
				JSON.stringify({
					companies: {
						columns: {
							id: { type: "integer", primaryKey: true },
							name: { type: "text", nullable: false },
							country: { type: "text" },
							rating: { type: "integer" },
							requiredProducts: { type: "text" },
							createdAt: { type: "integer" },
						},
					},
					contacts: {
						columns: {
							id: { type: "integer", primaryKey: true },
							companyId: { type: "integer", references: "companies.id" },
							name: { type: "text" },
							email: { type: "text" },
							phone: { type: "text" },
						},
					},
				});

			console.log("\n=== Pipeline Comparison Start ===");
			console.log("Query:", input.query);

			// Run both pipelines in parallel
			const [original, simplified] = await Promise.all([
				runOriginalPipeline(
					ctx,
					input.query,
					testSchema,
					input.vectorizedFields,
				),
				runSimplifiedPipeline(
					ctx,
					input.query,
					testSchema,
					input.vectorizedFields,
				),
			]);

			// Calculate improvements
			const improvements = {
				analysisTime: (
					((original.times.analysis - simplified.times.analysis) /
						original.times.analysis) *
					100
				).toFixed(1),
				schemaTime: (
					((original.times.schema - simplified.times.schema) /
						original.times.schema) *
					100
				).toFixed(1),
				sqlTime: (
					((original.times.sql - simplified.times.sql) / original.times.sql) *
					100
				).toFixed(1),
				totalTime: (
					((original.times.total - simplified.times.total) /
						original.times.total) *
					100
				).toFixed(1),

				analysisFields: (
					((original.complexity.analysisFields -
						simplified.complexity.analysisFields) /
						original.complexity.analysisFields) *
					100
				).toFixed(1),
				schemaFields: (
					((original.complexity.schemaFields -
						simplified.complexity.schemaFields) /
						original.complexity.schemaFields) *
					100
				).toFixed(1),
				sqlFields: (
					((original.complexity.sqlFields - simplified.complexity.sqlFields) /
						original.complexity.sqlFields) *
					100
				).toFixed(1),
			};

			console.log("\n=== Comparison Results ===");
			console.log("Time Improvements:", improvements);
			console.log("Original SQL:", original.sql?.substring(0, 100) + "...");
			console.log("Simplified SQL:", simplified.sql?.substring(0, 100) + "...");
			console.log("=== Comparison End ===\n");

			return {
				query: input.query,
				original: {
					...original,
					sql:
						original.sql?.substring(0, 200) +
						(original.sql?.length > 200 ? "..." : ""),
				},
				simplified: {
					...simplified,
					sql:
						simplified.sql?.substring(0, 200) +
						(simplified.sql?.length > 200 ? "..." : ""),
				},
				improvements,
				recommendation:
					improvements.totalTime > "20"
						? "Simplified pipeline recommended - significant performance gain"
						: "Both pipelines perform similarly - use based on requirements",
			};
		}),
});

async function runOriginalPipeline(
	ctx: any,
	query: string,
	schema: string,
	vectorizedFields?: Record<string, string[]>,
) {
	const times = { analysis: 0, schema: 0, sql: 0, total: 0 };
	const complexity = { analysisFields: 0, schemaFields: 0, sqlFields: 0 };

	try {
		// Step 1: Original Query Analysis
		const analysisStart = Date.now();
		const analysisResult = await ctx.queryAnalyzer.analyze({
			query,
			databaseSchema: schema,
			vectorizedFields,
		});
		times.analysis = Date.now() - analysisStart;
		complexity.analysisFields = countFields(analysisResult.analysis);

		if (analysisResult.analysis.routing.strategy === "rejected") {
			return {
				times,
				complexity,
				strategy: "rejected",
				error: analysisResult.analysis.feasibility.reason,
			};
		}

		// Step 2: Original Schema Selection (if needed)
		if (analysisResult.analysis.sqlConfig) {
			const schemaStart = Date.now();
			const schemaResult = await ctx.schemaSelector.select({
				query,
				sqlConfig: analysisResult.analysis.sqlConfig,
				fullSchema: schema,
			});
			times.schema = Date.now() - schemaStart;
			complexity.schemaFields = countFields(schemaResult.result);

			// Step 3: Original SQL Building
			const sqlStart = Date.now();
			const sqlResult = await ctx.sqlBuilder.build({
				query,
				slimSchema: schemaResult.result.slimSchema,
				selectedTables: schemaResult.result.selectedTables,
				sqlHints: schemaResult.result.sqlHints,
			});
			times.sql = Date.now() - sqlStart;
			complexity.sqlFields = countFields(sqlResult.result);

			times.total = times.analysis + times.schema + times.sql;
			return {
				times,
				complexity,
				strategy: analysisResult.analysis.routing.strategy,
				sql: sqlResult.result.sql,
				cached: {
					analysis: analysisResult.cached || false,
					schema: schemaResult.cached || false,
					sql: sqlResult.cached || false,
				},
			};
		}

		times.total = times.analysis;
		return {
			times,
			complexity,
			strategy: analysisResult.analysis.routing.strategy,
		};
	} catch (error) {
		console.error("Original pipeline error:", error);
		return {
			times,
			complexity,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function runSimplifiedPipeline(
	ctx: any,
	query: string,
	schema: string,
	vectorizedFields?: Record<string, string[]>,
) {
	const times = { analysis: 0, schema: 0, sql: 0, total: 0 };
	const complexity = { analysisFields: 0, schemaFields: 0, sqlFields: 0 };

	try {
		// Step 1: Simplified Query Analysis
		const analysisStart = Date.now();
		const analysisResult = await ctx.queryAnalyzer.analyze({
			query,
			databaseSchema: schema,
			vectorizedFields,
		});
		times.analysis = Date.now() - analysisStart;
		complexity.analysisFields = countFields(analysisResult.analysis);

		if (analysisResult.analysis.routing.strategy === "rejected") {
			return {
				times,
				complexity,
				strategy: "rejected",
				error: analysisResult.analysis.reason,
			};
		}

		// Step 2: Simplified Schema Selection (if needed)
		if (analysisResult.analysis.sqlTables) {
			const schemaStart = Date.now();
			const schemaResult = await ctx.schemaSelector.select({
				query,
				tables: analysisResult.analysis.sqlTables,
				databaseSchema: schema,
				vectorIds: analysisResult.analysis.vectorQueries
					? [1, 2, 3]
					: undefined, // Mock IDs
			});
			times.schema = Date.now() - schemaStart;
			complexity.schemaFields = countFields(schemaResult.result);

			// Step 3: Simplified SQL Building
			const sqlStart = Date.now();
			const difficulty =
				analysisResult.analysis.routing.confidence > 0.8 ? "easy" : "hard";
			const sqlResult = await ctx.sqlBuilder.build({
				query,
				...schemaResult.result,
				difficulty,
				vectorIds: analysisResult.analysis.vectorQueries
					? [1, 2, 3]
					: undefined,
			});
			times.sql = Date.now() - sqlStart;
			complexity.sqlFields = countFields(sqlResult.result);

			times.total = times.analysis + times.schema + times.sql;
			return {
				times,
				complexity,
				strategy: analysisResult.analysis.routing.strategy,
				sql: sqlResult.result.sql,
				cached: {
					analysis: analysisResult.cached || false,
					schema: schemaResult.cached || false,
					sql: sqlResult.cached || false,
				},
			};
		}

		times.total = times.analysis;
		return {
			times,
			complexity,
			strategy: analysisResult.analysis.routing.strategy,
		};
	} catch (error) {
		console.error("Simplified pipeline error:", error);
		return {
			times,
			complexity,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function countFields(obj: any): number {
	let count = 0;
	for (const key in obj) {
		if (obj[key] !== null && obj[key] !== undefined) {
			if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
				count += countFields(obj[key]);
			} else {
				count++;
			}
		}
	}
	return count;
}
