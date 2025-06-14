"use client";

import { api } from "@/trpc/react";
import { useState } from "react";

export default function TestOptimization() {
	const [query, setQuery] = useState(
		"找一下对 ERP 相关产品感兴趣的日本 3 星以上的客户",
	);
	const [isComparing, setIsComparing] = useState(false);
	const [results, setResults] = useState<any>(null);

	const compareMutation = (
		api as any
	).pipelineComparison.compareFullPipeline.useMutation({
		onSuccess: (data: any) => {
			setResults(data);
			setIsComparing(false);
		},
		onError: (error: any) => {
			console.error("Comparison error:", error);
			setIsComparing(false);
		},
	});

	const handleCompare = () => {
		setIsComparing(true);
		setResults(null);
		compareMutation.mutate({
			query,
			databaseSchema: "", // Will use default test schema
		});
	};

	return (
		<div className="mx-auto max-w-6xl p-8">
			<h1 className="mb-8 font-bold text-3xl">Pipeline Optimization Test</h1>

			<div className="mb-8">
				<label htmlFor="query" className="mb-2 block font-medium text-sm">
					Test Query
				</label>
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="w-full rounded-lg border p-3"
					placeholder="Enter a query to test..."
				/>
				<button
					onClick={handleCompare}
					disabled={isComparing || !query}
					className="mt-4 rounded-lg bg-blue-500 px-6 py-3 text-white hover:bg-blue-600 disabled:opacity-50"
				>
					{isComparing ? "Comparing..." : "Compare Pipelines"}
				</button>
			</div>

			{results && (
				<div className="space-y-6">
					{/* Summary */}
					<div className="rounded-lg border border-green-200 bg-green-50 p-6">
						<h2 className="mb-4 font-semibold text-xl">
							Performance Improvements
						</h2>
						<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
							<div>
								<div className="text-gray-600 text-sm">Total Time</div>
								<div className="font-bold text-2xl text-green-600">
									{results.improvements.totalTime}% faster
								</div>
							</div>
							<div>
								<div className="text-gray-600 text-sm">Analysis</div>
								<div className="font-semibold text-xl">
									{results.improvements.analysisTime}% faster
								</div>
							</div>
							<div>
								<div className="text-gray-600 text-sm">Schema</div>
								<div className="font-semibold text-xl">
									{results.improvements.schemaTime}% faster
								</div>
							</div>
							<div>
								<div className="text-gray-600 text-sm">SQL Build</div>
								<div className="font-semibold text-xl">
									{results.improvements.sqlTime}% faster
								</div>
							</div>
						</div>
					</div>

					{/* Field Reduction */}
					<div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
						<h2 className="mb-4 font-semibold text-xl">Complexity Reduction</h2>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<div className="text-gray-600 text-sm">Analysis Fields</div>
								<div className="font-semibold text-blue-600 text-xl">
									{results.improvements.analysisFields}% fewer
								</div>
								<div className="text-gray-500 text-sm">
									{results.simplified.complexity.analysisFields} vs{" "}
									{results.original.complexity.analysisFields}
								</div>
							</div>
							<div>
								<div className="text-gray-600 text-sm">Schema Fields</div>
								<div className="font-semibold text-blue-600 text-xl">
									{results.improvements.schemaFields}% fewer
								</div>
								<div className="text-gray-500 text-sm">
									{results.simplified.complexity.schemaFields} vs{" "}
									{results.original.complexity.schemaFields}
								</div>
							</div>
							<div>
								<div className="text-gray-600 text-sm">SQL Fields</div>
								<div className="font-semibold text-blue-600 text-xl">
									{results.improvements.sqlFields}% fewer
								</div>
								<div className="text-gray-500 text-sm">
									{results.simplified.complexity.sqlFields} vs{" "}
									{results.original.complexity.sqlFields}
								</div>
							</div>
						</div>
					</div>

					{/* Detailed Comparison */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						{/* Original Pipeline */}
						<div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
							<h3 className="mb-4 font-semibold text-lg">Original Pipeline</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span>Strategy:</span>
									<span className="font-mono">{results.original.strategy}</span>
								</div>
								<div className="flex justify-between">
									<span>Total Time:</span>
									<span className="font-mono">
										{results.original.times.total}ms
									</span>
								</div>
								<div className="flex justify-between">
									<span>Cache Hits:</span>
									<span>
										{
											Object.values(results.original.cached || {}).filter(
												Boolean,
											).length
										}
										/3
									</span>
								</div>
							</div>
							{results.original.sql && (
								<div className="mt-4">
									<div className="mb-1 font-medium text-sm">Generated SQL:</div>
									<pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs">
										{results.original.sql}
									</pre>
								</div>
							)}
						</div>

						{/* Simplified Pipeline */}
						<div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
							<h3 className="mb-4 font-semibold text-lg">
								Simplified Pipeline
							</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span>Strategy:</span>
									<span className="font-mono">
										{results.simplified.strategy}
									</span>
								</div>
								<div className="flex justify-between">
									<span>Total Time:</span>
									<span className="font-mono">
										{results.simplified.times.total}ms
									</span>
								</div>
								<div className="flex justify-between">
									<span>Cache Hits:</span>
									<span>
										{
											Object.values(results.simplified.cached || {}).filter(
												Boolean,
											).length
										}
										/3
									</span>
								</div>
							</div>
							{results.simplified.sql && (
								<div className="mt-4">
									<div className="mb-1 font-medium text-sm">Generated SQL:</div>
									<pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs">
										{results.simplified.sql}
									</pre>
								</div>
							)}
						</div>
					</div>

					{/* Recommendation */}
					<div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
						<div className="font-semibold">{results.recommendation}</div>
					</div>
				</div>
			)}
		</div>
	);
}
