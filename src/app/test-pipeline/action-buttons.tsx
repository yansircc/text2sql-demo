import type { PipelineResults } from "./types";

interface ActionButtonsProps {
	query: string;
	results: PipelineResults;
	onRunFullPipeline: () => void;
	onPreHandle: () => void;
	onPreSQL: () => void;
	onSlimSchema: () => void;
	onGenSQL: () => void;
	onRunSQL: () => void;
	onClearResults: () => void;
}

export function ActionButtons({
	query,
	results,
	onRunFullPipeline,
	onPreHandle,
	onPreSQL,
	onSlimSchema,
	onGenSQL,
	onRunSQL,
	onClearResults,
}: ActionButtonsProps) {
	return (
		<div
			style={{
				marginBottom: "20px",
				display: "flex",
				gap: "10px",
				flexWrap: "wrap",
			}}
		>
			<button
				type="button"
				onClick={onRunFullPipeline}
				disabled={!query}
				style={{
					padding: "10px 20px",
					cursor: query ? "pointer" : "not-allowed",
					opacity: query ? 1 : 0.5,
					backgroundColor: "#4CAF50",
					color: "white",
					fontWeight: "bold",
				}}
			>
				🚀 运行全流程
			</button>
			<div style={{ width: "100%", height: "10px" }} />
			<button
				type="button"
				onClick={onPreHandle}
				disabled={!query}
				style={{
					padding: "10px 20px",
					cursor: query ? "pointer" : "not-allowed",
					opacity: query ? 1 : 0.5,
				}}
			>
				1. Pre-Handle
			</button>
			<button
				type="button"
				onClick={onPreSQL}
				disabled={!query || !results.preHandle}
				style={{
					padding: "10px 20px",
					cursor: query && results.preHandle ? "pointer" : "not-allowed",
					opacity: query && results.preHandle ? 1 : 0.5,
				}}
			>
				2. Pre-SQL
			</button>
			<button
				type="button"
				onClick={onSlimSchema}
				disabled={!query || !results.preSQL}
				style={{
					padding: "10px 20px",
					cursor: query && results.preSQL ? "pointer" : "not-allowed",
					opacity: query && results.preSQL ? 1 : 0.5,
				}}
			>
				3. Slim Schema
			</button>
			<button
				type="button"
				onClick={onGenSQL}
				disabled={!query || !results.preSQL || !results.slimSchema}
				style={{
					padding: "10px 20px",
					cursor:
						query && results.preSQL && results.slimSchema
							? "pointer"
							: "not-allowed",
					opacity: query && results.preSQL && results.slimSchema ? 1 : 0.5,
				}}
			>
				4. Gen SQL
			</button>
			<button
				type="button"
				onClick={onRunSQL}
				disabled={!query || !results.genSQL}
				style={{
					padding: "10px 20px",
					cursor: query && results.genSQL ? "pointer" : "not-allowed",
					opacity: query && results.genSQL ? 1 : 0.5,
					backgroundColor: "#FF9800",
					color: "white",
				}}
			>
				5. Run SQL
			</button>
			<button
				type="button"
				onClick={onClearResults}
				style={{
					padding: "10px 20px",
					cursor: "pointer",
					backgroundColor: "#ff4444",
					color: "white",
				}}
			>
				清除结果
			</button>
		</div>
	);
}
