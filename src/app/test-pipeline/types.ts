export interface PipelineResults {
	preHandle?: any;
	preSQL?: any;
	slimSchema?: any;
	genSQL?: any;
	runSQL?: any;
}

export interface PipelineStepProps {
	query: string;
	results: PipelineResults;
	onResultsChange: (results: PipelineResults) => void;
}
