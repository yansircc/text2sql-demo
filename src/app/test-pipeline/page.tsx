"use client";

import { ActionButtons } from "./action-buttons";
import { ProcessDescription } from "./process-description";
import { ExampleQueries } from "./queries";
import { QueryInput } from "./query-input";
import { ResultDisplay } from "./result-display";
import { usePipeline } from "./use-pipeline";

export default function TestPipelinePage() {
	const {
		query,
		setQuery,
		results,
		handlePreHandle,
		handlePreSQL,
		handleSlimSchema,
		handleGenSQL,
		handleRunSQL,
		clearResults,
		runFullPipeline,
	} = usePipeline();

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h1>查询管道测试</h1>

			<ProcessDescription />

			<ExampleQueries onQuerySelect={setQuery} />

			<QueryInput query={query} onQueryChange={setQuery} />

			<ActionButtons
				query={query}
				results={results}
				onRunFullPipeline={runFullPipeline}
				onPreHandle={handlePreHandle}
				onPreSQL={handlePreSQL}
				onSlimSchema={handleSlimSchema}
				onGenSQL={handleGenSQL}
				onRunSQL={handleRunSQL}
				onClearResults={clearResults}
			/>

			<ResultDisplay results={results} />
		</div>
	);
}
