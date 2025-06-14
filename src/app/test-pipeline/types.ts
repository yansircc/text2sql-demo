export interface WorkflowResult {
	queryId: string;
	status: "success" | "partial" | "failed";
	strategy: "sql_only" | "vector_only" | "hybrid" | "rejected";
	data?: Array<Record<string, unknown>>;
	rowCount?: number;
	metadata?: {
		totalTime: number;
		steps: Array<{
			name: string;
			status: "success" | "skipped" | "failed";
			time: number;
			error?: string;
			cached?: boolean;
		}>;
		sql?: string;
		vectorSearchCount?: number;
		fusionMethod?: string;
		sqlModel?: string;
		sqlDifficulty?: string;
		cacheHits?: number;
	};
	error?: string;
	suggestions?: string[];
}

export interface PipelineResults {
	workflow?: WorkflowResult;
}

export interface PipelineStepProps {
	query: string;
	results: PipelineResults;
	onResultsChange: (results: PipelineResults) => void;
}
