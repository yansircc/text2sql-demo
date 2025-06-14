// Example of optimized workflow with parallel execution

// In hybrid mode, run vector search and schema selection in parallel
if (analysis.routing.strategy === "hybrid" && analysis.vectorConfig && analysis.sqlConfig) {
	console.log("[Workflow] 执行混合搜索 - 并行处理");
	
	// Run vector search and schema selection in parallel
	const [vectorResult, schemaResult] = await Promise.all([
		// Vector search
		api.vectorSearch.search({
			queries: analysis.vectorConfig.queries,
			hnswEf: 128,
		}),
		// Schema selection
		api.schemaSelector.select({
			query: input.query,
			sqlConfig: analysis.sqlConfig,
			fullSchema: JSON.stringify(filteredSchema),
			// Schema selection doesn't need vector context initially
		}),
	]);

	// Record both operations
	steps.push(
		{
			name: "VectorSearch",
			status: "success",
			time: vectorResult.executionTime || 0,
		},
		{
			name: "SchemaSelection",
			status: "success",
			time: schemaResult.executionTime || 0,
		},
	);

	// Continue with SQL building using results from both...
}