"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export default function TestOptimization() {
	const [query, setQuery] = useState("找一下对 ERP 相关产品感兴趣的日本 3 星以上的客户");
	const [isComparing, setIsComparing] = useState(false);
	const [results, setResults] = useState<any>(null);

	const compareMutation = api.pipelineComparison.compareFullPipeline.useMutation({
		onSuccess: (data) => {
			setResults(data);
			setIsComparing(false);
		},
		onError: (error) => {
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
		<div className="p-8 max-w-6xl mx-auto">
			<h1 className="text-3xl font-bold mb-8">Pipeline Optimization Test</h1>
			
			<div className="mb-8">
				<label className="block text-sm font-medium mb-2">Test Query</label>
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="w-full p-3 border rounded-lg"
					placeholder="Enter a query to test..."
				/>
				<button
					onClick={handleCompare}
					disabled={isComparing || !query}
					className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
				>
					{isComparing ? "Comparing..." : "Compare Pipelines"}
				</button>
			</div>

			{results && (
				<div className="space-y-6">
					{/* Summary */}
					<div className="bg-green-50 border border-green-200 rounded-lg p-6">
						<h2 className="text-xl font-semibold mb-4">Performance Improvements</h2>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div>
								<div className="text-sm text-gray-600">Total Time</div>
								<div className="text-2xl font-bold text-green-600">
									{results.improvements.totalTime}% faster
								</div>
							</div>
							<div>
								<div className="text-sm text-gray-600">Analysis</div>
								<div className="text-xl font-semibold">
									{results.improvements.analysisTime}% faster
								</div>
							</div>
							<div>
								<div className="text-sm text-gray-600">Schema</div>
								<div className="text-xl font-semibold">
									{results.improvements.schemaTime}% faster
								</div>
							</div>
							<div>
								<div className="text-sm text-gray-600">SQL Build</div>
								<div className="text-xl font-semibold">
									{results.improvements.sqlTime}% faster
								</div>
							</div>
						</div>
					</div>

					{/* Field Reduction */}
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
						<h2 className="text-xl font-semibold mb-4">Complexity Reduction</h2>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<div className="text-sm text-gray-600">Analysis Fields</div>
								<div className="text-xl font-semibold text-blue-600">
									{results.improvements.analysisFields}% fewer
								</div>
								<div className="text-sm text-gray-500">
									{results.simplified.complexity.analysisFields} vs {results.original.complexity.analysisFields}
								</div>
							</div>
							<div>
								<div className="text-sm text-gray-600">Schema Fields</div>
								<div className="text-xl font-semibold text-blue-600">
									{results.improvements.schemaFields}% fewer
								</div>
								<div className="text-sm text-gray-500">
									{results.simplified.complexity.schemaFields} vs {results.original.complexity.schemaFields}
								</div>
							</div>
							<div>
								<div className="text-sm text-gray-600">SQL Fields</div>
								<div className="text-xl font-semibold text-blue-600">
									{results.improvements.sqlFields}% fewer
								</div>
								<div className="text-sm text-gray-500">
									{results.simplified.complexity.sqlFields} vs {results.original.complexity.sqlFields}
								</div>
							</div>
						</div>
					</div>

					{/* Detailed Comparison */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Original Pipeline */}
						<div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
							<h3 className="text-lg font-semibold mb-4">Original Pipeline</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span>Strategy:</span>
									<span className="font-mono">{results.original.strategy}</span>
								</div>
								<div className="flex justify-between">
									<span>Total Time:</span>
									<span className="font-mono">{results.original.times.total}ms</span>
								</div>
								<div className="flex justify-between">
									<span>Cache Hits:</span>
									<span>
										{Object.values(results.original.cached || {}).filter(Boolean).length}/3
									</span>
								</div>
							</div>
							{results.original.sql && (
								<div className="mt-4">
									<div className="text-sm font-medium mb-1">Generated SQL:</div>
									<pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
										{results.original.sql}
									</pre>
								</div>
							)}
						</div>

						{/* Simplified Pipeline */}
						<div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
							<h3 className="text-lg font-semibold mb-4">Simplified Pipeline</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span>Strategy:</span>
									<span className="font-mono">{results.simplified.strategy}</span>
								</div>
								<div className="flex justify-between">
									<span>Total Time:</span>
									<span className="font-mono">{results.simplified.times.total}ms</span>
								</div>
								<div className="flex justify-between">
									<span>Cache Hits:</span>
									<span>
										{Object.values(results.simplified.cached || {}).filter(Boolean).length}/3
									</span>
								</div>
							</div>
							{results.simplified.sql && (
								<div className="mt-4">
									<div className="text-sm font-medium mb-1">Generated SQL:</div>
									<pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
										{results.simplified.sql}
									</pre>
								</div>
							)}
						</div>
					</div>

					{/* Recommendation */}
					<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
						<div className="font-semibold">{results.recommendation}</div>
					</div>
				</div>
			)}
		</div>
	);
}