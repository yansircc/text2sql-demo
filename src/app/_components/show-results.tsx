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
								📄 生成的 PreSQL (v3.0 - 2025最佳实践)
							</h4>
							{result.preSQL.error ? (
								<div className="rounded bg-red-50 p-3 text-red-800">
									<strong>错误:</strong> {result.preSQL.error}
								</div>
							) : (
								<div className="space-y-4">
									{/* 核心信息摘要 */}
									<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
										<div className="rounded bg-blue-50 p-3 text-blue-700">
											<div className="font-medium">涉及的表</div>
											<div className="font-semibold text-sm">
												{result.preSQL.selectedTables?.length || 0} 张表
											</div>
										</div>
										<div className="rounded bg-purple-50 p-3 text-purple-700">
											<div className="font-medium">时间范围</div>
											<div className="font-semibold text-sm">
												{result.preSQL.timeRange || "无时间限制"}
											</div>
										</div>
										<div className="rounded bg-green-50 p-3 text-green-700">
											<div className="font-medium">分析步骤</div>
											<div className="text-sm">
												{result.preSQL.analysisSteps?.length || 0} 步
											</div>
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
													💡 SQL 生成提示
												</h5>
												<div className="space-y-2 text-sm">
													{result.preSQL.sqlHints.orderBy && (
														<div>
															<span className="font-semibold text-gray-700">
																排序:
															</span>{" "}
															{result.preSQL.sqlHints.orderBy
																.map((o) => `${o.field} ${o.direction}`)
																.join(", ")}
														</div>
													)}
													{result.preSQL.sqlHints.groupBy && (
														<div>
															<span className="font-semibold text-gray-700">
																分组:
															</span>{" "}
															{result.preSQL.sqlHints.groupBy.join(", ")}
														</div>
													)}
													{result.preSQL.sqlHints.limit && (
														<div>
															<span className="font-semibold text-gray-700">
																限制:
															</span>{" "}
															{result.preSQL.sqlHints.limit} 条
														</div>
													)}
													{result.preSQL.sqlHints.specialConditions && (
														<div>
															<span className="font-semibold text-gray-700">
																特殊条件:
															</span>
															<ul className="mt-1 list-inside list-disc text-gray-600">
																{result.preSQL.sqlHints.specialConditions.map(
																	(condition, idx) => (
																		<li key={idx}>{condition}</li>
																	),
																)}
															</ul>
														</div>
													)}
												</div>
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
