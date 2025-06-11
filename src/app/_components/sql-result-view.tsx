"use client";

import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";

export function SQLResultView() {
	const { currentSession } = useAppStore();
	const [isCopied, setIsCopied] = useState(false);

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
					<pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-white">
						<code className="language-sql">{currentSession.sqlResult.sql}</code>
					</pre>
				</div>

				{/* PreSQL 信息摘要 */}
				<div className="mt-6 grid grid-cols-2 gap-4">
					<div className="rounded-lg bg-gray-50 p-4">
						<h4 className="mb-2 font-semibold text-gray-700">查询类型</h4>
						<p className="text-gray-600">{currentSession.preSQL.queryType}</p>
					</div>
					<div className="rounded-lg bg-gray-50 p-4">
						<h4 className="mb-2 font-semibold text-gray-700">复杂度</h4>
						<p className="text-gray-600">
							{currentSession.preSQL.difficulty === "simple"
								? "简单"
								: currentSession.preSQL.difficulty === "medium"
									? "中等"
									: "困难"}
						</p>
					</div>
				</div>

				{/* 时间戳 */}
				<div className="mt-4 text-gray-500 text-sm">
					生成时间：{new Date(currentSession.timestamp).toLocaleString("zh-CN")}
				</div>
			</div>

			{/* 使用提示 */}
			<div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
				<h3 className="mb-2 font-semibold text-yellow-800">⚡ 使用提示</h3>
				<ul className="list-inside list-disc space-y-1 text-sm text-yellow-700">
					<li>请在执行前检查 SQL 语句的正确性</li>
					<li>对于大数据量查询，建议添加适当的 LIMIT 限制</li>
					<li>如需优化性能，可根据查询需求添加合适的索引</li>
				</ul>
			</div>
		</div>
	);
}
