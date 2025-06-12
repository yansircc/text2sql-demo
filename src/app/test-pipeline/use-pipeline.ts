import { api } from "@/trpc/react";
import { useState } from "react";
import { DatabaseSchema, VectorizedFieldsMap } from "./constants";
import type { PipelineResults } from "./types";

export function usePipeline() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PipelineResults>({});

	// 新版工作流 API
	const workflowMutation = api.workflow.execute.useMutation();

	// 执行查询
	const executeQuery = async () => {
		try {
			setResults({}); // 清除旧结果

			const result = await workflowMutation.mutateAsync({
				query,
				databaseSchema: DatabaseSchema,
				vectorizedFields: VectorizedFieldsMap,
				options: {
					maxRows: 100,
				},
			});

			setResults({ workflow: result });
		} catch (error) {
			console.error("工作流执行错误:", error);
			setResults({
				workflow: {
					queryId: `error_${Date.now()}`,
					status: "failed",
					strategy: "rejected",
					error: String(error),
					metadata: {
						totalTime: 0,
						steps: [],
					},
				},
			});
		}
	};

	// 清除结果
	const clearResults = () => {
		setResults({});
	};

	return {
		query,
		setQuery,
		results,
		executeQuery,
		clearResults,
		isLoading: workflowMutation.isPending,
	};
}
