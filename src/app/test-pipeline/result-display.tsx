import type { PipelineResults } from "./types";

interface ResultDisplayProps {
	results: PipelineResults;
}

interface ResultSectionProps {
	title: string;
	result: any;
}

function ResultSection({ title, result }: ResultSectionProps) {
	return (
		<div style={{ marginBottom: "20px" }}>
			<h3>{title}:</h3>
			<pre
				style={{
					backgroundColor: "#f5f5f5",
					padding: "10px",
					overflow: "auto",
					maxHeight: "400px",
				}}
			>
				{JSON.stringify(result, null, 2)}
			</pre>
		</div>
	);
}

export function ResultDisplay({ results }: ResultDisplayProps) {
	// 获取语义搜索结果
	const vectorResult =
		results.preHandle?.hybridSearch?.vectorResult ||
		results.preHandle?.vectorSearchResult;

	return (
		<div>
			{results.preHandle && (
				<ResultSection title="Pre-Handle 结果" result={results.preHandle} />
			)}

			{/* 如果有语义搜索结果，单独展示 */}
			{vectorResult && (
				<ResultSection title="语义搜索结果" result={vectorResult} />
			)}

			{results.preSQL && (
				<ResultSection title="Pre-SQL 结果" result={results.preSQL} />
			)}
			{results.slimSchema && (
				<ResultSection title="Slim Schema 结果" result={results.slimSchema} />
			)}
			{results.genSQL && (
				<ResultSection title="Gen SQL 结果" result={results.genSQL} />
			)}
			{results.runSQL && (
				<ResultSection title="Run SQL 结果" result={results.runSQL} />
			)}
		</div>
	);
}
