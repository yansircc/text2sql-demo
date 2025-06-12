"use client";

import { useAppStore } from "@/store/useAppStore";
import { api } from "@/trpc/react";
import { useState } from "react";

export function SQLResultView() {
	const { currentSession } = useAppStore();
	const [isCopied, setIsCopied] = useState(false);
	const [showResults, setShowResults] = useState(false);
	const [executionResult, setExecutionResult] = useState<any>(null);

	// SQL 验证
	const validateSQLMutation = api.runSQL.validateSQL.useMutation({
		onSuccess: (data) => {
			if (!data.isValid) {
				alert("SQL 验证失败：\n" + (data.errors || []).join("\n"));
			}
		},
	});

	// SQL 执行
	const executeSQLMutation = api.runSQL.executeSQL.useMutation({
		onSuccess: (data) => {
			setExecutionResult(data);
			setShowResults(true);
		},
		onError: (error) => {
			alert("SQL 执行失败：" + error.message);
		},
	});

	if (!currentSession?.sqlResult?.sql) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-gray-500">没有找到 SQL 生成结果</p>
			</div>
		);
	}

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(currentSession.sqlResult!.sql);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		} catch (err) {
			console.error("复制失败:", err);
		}
	};

	const handleValidate = () => {
		validateSQLMutation.mutate({
			sql: currentSession.sqlResult!.sql,
		});
	};

	const handleExecute = async () => {
		// 先验证
		const validation = await validateSQLMutation.mutateAsync({
			sql: currentSession.sqlResult!.sql,
		});

		if (validation.isValid) {
			// 执行 SQL
			executeSQLMutation.mutate({
				sql: currentSession.sqlResult!.sql,
				readOnly: true, // 默认只读模式，更安全
			});
		}
	};

	return (
		<div className="space-y-6">
			{/* 查询信息 */}
			<div className="rounded-lg bg-white p-6 shadow-lg">
				<h2 className="mb-4 font-bold text-2xl text-gray-800">
					🎯 SQL 生成结果
				</h2>

				<div className="mb-4 rounded-lg bg-blue-50 p-4">
					<p className="mb-1 text-gray-600 text-sm">原始查询：</p>
					<p className="font-medium text-gray-800">
						{currentSession.originalQuery}
					</p>
				</div>

				{/* SQL 语句 */}
				<div className="relative">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="font-semibold text-gray-700 text-lg">
							生成的 SQL 语句
						</h3>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleValidate}
								disabled={validateSQLMutation.isPending}
								className="flex items-center gap-2 rounded-md bg-blue-100 px-3 py-1.5 text-sm transition-colors hover:bg-blue-200 disabled:opacity-50"
							>
								<svg
									className="h-4 w-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<title>验证图标</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								{validateSQLMutation.isPending ? "验证中..." : "验证"}
							</button>
							<button
								type="button"
								onClick={handleExecute}
								disabled={executeSQLMutation.isPending}
								className="flex items-center gap-2 rounded-md bg-green-100 px-3 py-1.5 text-sm transition-colors hover:bg-green-200 disabled:opacity-50"
							>
								<svg
									className="h-4 w-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<title>执行图标</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
									/>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								{executeSQLMutation.isPending ? "执行中..." : "执行"}
							</button>
							<button
								type="button"
								onClick={handleCopy}
								className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 text-sm transition-colors hover:bg-gray-200"
							>
								{isCopied ? (
									<>
										<svg
											className="h-4 w-4 text-green-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<title>已复制图标</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M5 13l4 4L19 7"
											/>
										</svg>
										已复制
									</>
								) : (
									<>
										<svg
											className="h-4 w-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<title>复制图标</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
										复制
									</>
								)}
							</button>
						</div>
					</div>
					<pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-white">
						<code className="language-sql">{currentSession.sqlResult.sql}</code>
					</pre>
				</div>

				{/* PreSQL 信息摘要 */}
				<div className="mt-6 grid grid-cols-2 gap-4">
					<div className="rounded-lg bg-gray-50 p-4">
						<h4 className="mb-2 font-semibold text-gray-700">涉及的表</h4>
						<p className="text-gray-600">
							{currentSession.preSQL.selectedTables
								.map((t) => t.tableName)
								.join(", ")}
						</p>
					</div>
					<div className="rounded-lg bg-gray-50 p-4">
						<h4 className="mb-2 font-semibold text-gray-700">分析步骤数</h4>
						<p className="text-gray-600">
							{currentSession.preSQL.analysisSteps.length} 步
						</p>
					</div>
				</div>

				{/* 时间戳 */}
				<div className="mt-4 text-gray-500 text-sm">
					生成时间：{new Date(currentSession.timestamp).toLocaleString("zh-CN")}
				</div>
			</div>

			{/* SQL 执行结果 */}
			{showResults && executionResult && (
				<div className="rounded-lg bg-white p-6 shadow-lg">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="font-semibold text-gray-800 text-xl">📊 执行结果</h3>
						<button
							type="button"
							onClick={() => setShowResults(false)}
							className="text-gray-500 hover:text-gray-700"
						>
							<svg
								className="h-5 w-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>关闭结果</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>

					{executionResult.success ? (
						<>
							<div className="mb-4 flex items-center justify-between text-gray-600 text-sm">
								<span>返回 {executionResult.rowCount} 行数据</span>
								<span>执行时间：{executionResult.executionTime}ms</span>
							</div>

							{executionResult.data && executionResult.data.length > 0 ? (
								<div className="overflow-x-auto">
									<table className="min-w-full divide-y divide-gray-200">
										<thead className="bg-gray-50">
											<tr>
												{Object.keys(executionResult.data[0]).map((key) => (
													<th
														key={key}
														className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider"
													>
														{key}
													</th>
												))}
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-200 bg-white">
											{executionResult.data
												.slice(0, 100)
												.map((row: any, index: number) => (
													<tr key={index} className="hover:bg-gray-50">
														{Object.values(row).map(
															(value: any, colIndex: number) => (
																<td
																	key={colIndex}
																	className="whitespace-nowrap px-6 py-4 text-gray-900 text-sm"
																>
																	{value === null ? (
																		<span className="text-gray-400">NULL</span>
																	) : (
																		String(value)
																	)}
																</td>
															),
														)}
													</tr>
												))}
										</tbody>
									</table>
									{executionResult.data.length > 100 && (
										<div className="mt-4 text-center text-gray-500 text-sm">
											显示前 100 行，共 {executionResult.data.length} 行
										</div>
									)}
								</div>
							) : (
								<div className="py-8 text-center text-gray-500">
									查询结果为空
								</div>
							)}

							{/* 原始 JSON 数据（折叠） */}
							<details className="mt-6">
								<summary className="cursor-pointer text-gray-600 text-sm hover:text-gray-800">
									查看原始 JSON 数据
								</summary>
								<pre className="mt-2 overflow-x-auto rounded-lg bg-gray-100 p-4 text-xs">
									{JSON.stringify(executionResult.data, null, 2)}
								</pre>
							</details>
						</>
					) : (
						<div className="rounded-lg bg-red-50 p-4">
							<p className="text-red-700">执行失败：{executionResult.error}</p>
						</div>
					)}
				</div>
			)}

			{/* 使用提示 */}
			<div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
				<h3 className="mb-2 font-semibold text-yellow-800">⚡ 使用提示</h3>
				<ul className="list-inside list-disc space-y-1 text-sm text-yellow-700">
					<li>点击"验证"按钮检查 SQL 语法是否正确</li>
					<li>点击"执行"按钮运行 SQL 并查看结果（只读模式）</li>
					<li>执行结果以表格形式展示，支持查看原始 JSON 数据</li>
					<li>为了安全，默认只允许执行 SELECT 查询</li>
				</ul>
			</div>
		</div>
	);
}
