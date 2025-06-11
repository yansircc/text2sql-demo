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
	return (
		<div>
			{results.preHandle && (
				<ResultSection title="Pre-Handle 结果" result={results.preHandle} />
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
