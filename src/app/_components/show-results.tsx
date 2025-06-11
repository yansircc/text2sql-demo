import type { PreSQL } from "@/server/api/routers/pre-sql";

// 扩展类型以支持错误情况
type PreSQLWithError = PreSQL & {
	error?: string;
};

interface ShowResultsProps {
	results: {
		query: string;
		preSQL: PreSQLWithError;
		timestamp: string;
	}[]; // 修改为 PreSQL 类型
}

export function ShowResults({ results }: ShowResultsProps) {
	function getDifficultyColor(difficulty: string) {
		switch (difficulty) {
			case "simple":
				return "bg-green-50 text-green-700";
			case "medium":
				return "bg-yellow-50 text-yellow-700";
			case "hard":
				return "bg-red-50 text-red-700";
			default:
				return "bg-gray-50 text-gray-700";
		}
	}

	function getConfidenceColor(confidence: string) {
		switch (confidence) {
			case "high":
				return "bg-green-50 text-green-700";
			case "medium":
				return "bg-yellow-50 text-yellow-700";
			case "low":
				return "bg-red-50 text-red-700";
			default:
				return "bg-gray-50 text-gray-700";
		}
	}

	return (
		<div className="rounded-lg bg-white p-6 shadow-lg">
			<h2 className="mb-4 font-semibold text-gray-800 text-xl">
				📋 PreSQL 生成历史
			</h2>
			<div className="space-y-6">
				{results.map((result, index) => (
					<div key={index} className="rounded-lg border bg-gray-50 p-4">
						{/* 查询信息 */}
						<div className="mb-4">
							<div className="flex items-start justify-between">
								<h3 className="font-medium text-gray-800">
									🔍 查询 #{results.length - index}
								</h3>
								<span className="text-gray-500 text-sm">
									{new Date(result.timestamp).toLocaleString()}
								</span>
							</div>
							<p className="mt-2 rounded bg-blue-50 p-3 text-blue-800">
								"{result.query}"
							</p>
						</div>

						{/* PreSQL 结果 */}
						<div>
							<h4 className="mb-3 font-medium text-gray-800">
								📄 生成的 PreSQL (v2.1 - 智能表字段选择)
							</h4>
							{result.preSQL.error ? (
								<div className="rounded bg-red-50 p-3 text-red-800">
									<strong>错误:</strong> {result.preSQL.error}
								</div>
							) : (
								<div className="space-y-4">
									{/* 核心信息摘要 */}
									<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
										<div
											className={`rounded p-3 ${getDifficultyColor(result.preSQL.difficulty)}`}
										>
											<div className="font-medium">难易程度</div>
											<div className="font-semibold text-sm">
												{result.preSQL.difficulty === "simple"
													? "简单"
													: result.preSQL.difficulty === "medium"
														? "中等"
														: "困难"}
											</div>
										</div>
										<div className="rounded bg-purple-50 p-3 text-purple-700">
											<div className="font-medium">语义搜索</div>
											<div className="font-semibold text-sm">
												{result.preSQL.needsSemanticSearch ? "需要" : "不需要"}
											</div>
										</div>

										<div className="rounded bg-indigo-50 p-3 text-indigo-700">
											<div className="font-medium">查询类型</div>
											<div className="text-sm">{result.preSQL.queryType}</div>
										</div>
									</div>

									{/* 精选的表和字段 - 新增重要展示区域 */}
									{result.preSQL.selectedTables &&
										result.preSQL.selectedTables.length > 0 && (
											<div className="rounded border-2 border-green-200 bg-gradient-to-r from-green-50 to-blue-50 p-4">
												<h5 className="mb-3 font-medium text-gray-800">
													🎯 精选的表和字段 (用于后续SQL生成)
												</h5>
												<div className="grid gap-3">
													{result.preSQL.selectedTables.map(
														(table: any, tableIndex: number) => (
															<div
																key={tableIndex}
																className="rounded border bg-white p-3 shadow-sm"
															>
																<div className="mb-2 flex items-start justify-between">
																	<h6 className="font-semibold text-blue-700">
																		📊 {table.tableName}
																	</h6>
																	<span className="rounded bg-blue-100 px-2 py-1 text-blue-700 text-xs">
																		{table.fields?.length || 0} 字段
																	</span>
																</div>
																<div className="mb-2">
																	<strong className="text-gray-700 text-sm">
																		字段:
																	</strong>
																	<div className="mt-1 flex flex-wrap gap-1">
																		{table.fields?.map(
																			(field: string, fieldIndex: number) => (
																				<span
																					key={fieldIndex}
																					className="rounded bg-gray-100 px-2 py-1 text-gray-700 text-xs"
																				>
																					{field}
																				</span>
																			),
																		)}
																	</div>
																</div>
																<div className="text-gray-600 text-xs">
																	<strong>原因:</strong> {table.reason}
																</div>
															</div>
														),
													)}
												</div>
												<div className="mt-3 rounded bg-green-100 p-2 text-green-700 text-xs">
													💡 这些精选的表和字段将传递给下一步的 SQL
													生成，大幅减少上下文噪音
												</div>
											</div>
										)}

									{/* 详细分析 */}
									<div className="space-y-3">
										<div className="rounded border bg-white p-3">
											<h5 className="mb-2 font-medium text-gray-700">
												🎯 难易程度分析
											</h5>
											<p className="text-gray-600 text-sm">
												{result.preSQL.difficultyReason}
											</p>
										</div>

										<div className="rounded border bg-white p-3">
											<h5 className="mb-2 font-medium text-gray-700">
												🗂️ 涉及的表和字段 (自然语言描述)
											</h5>
											<p className="text-gray-600 text-sm">
												{result.preSQL.tablesAndFields}
											</p>
										</div>

										<div className="rounded border bg-white p-3">
											<h5 className="mb-2 font-medium text-gray-700">
												📋 分析步骤
											</h5>
											<ol className="list-inside list-decimal space-y-1 text-gray-600 text-sm">
												{result.preSQL.analysisSteps?.map(
													(step: string, stepIndex: number) => (
														<li key={stepIndex}>{step}</li>
													),
												)}
											</ol>
										</div>

										{result.preSQL.timeRange && (
											<div className="rounded border bg-white p-3">
												<h5 className="mb-2 font-medium text-gray-700">
													⏰ 时间范围
												</h5>
												<p className="text-gray-600 text-sm">
													{result.preSQL.timeRange}
												</p>
											</div>
										)}

										{result.preSQL.sqlHints && (
											<div className="rounded border bg-white p-3">
												<h5 className="mb-2 font-medium text-gray-700">
													⚠️ 风险或注意事项
												</h5>
												<p className="text-gray-600 text-sm">
													{JSON.stringify(result.preSQL.sqlHints)}
												</p>
											</div>
										)}
									</div>

									{/* 完整 JSON */}
									<details className="rounded border">
										<summary className="cursor-pointer bg-gray-100 p-3 font-medium text-gray-800 hover:bg-gray-200">
											📋 查看完整 PreSQL JSON
										</summary>
										<pre className="overflow-auto bg-gray-900 p-4 text-green-400 text-sm">
											{JSON.stringify(result.preSQL, null, 2)}
										</pre>
									</details>
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
