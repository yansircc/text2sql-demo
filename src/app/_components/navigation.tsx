"use client";

import { useAppStore } from "@/store/useAppStore";

export function Navigation() {
	const { currentView, setCurrentView, currentSession } = useAppStore();

	const navItems = [
		{
			id: "input" as const,
			name: "Query Input",
			label: "📝 查询输入",
			description: "输入自然语言查询",
		},
		{
			id: "result" as const,
			name: "SQL Result",
			label: "🎯 SQL 结果",
			description: "查看生成的 SQL",
			disabled: !currentSession?.sqlResult,
		},
	];

	return (
		<div className="border-b bg-white shadow-sm">
			<div className="mx-auto max-w-6xl px-6">
				<div className="flex items-center justify-between py-4">
					{/* Logo 和标题 */}
					<div className="flex items-center gap-3">
						<div className="text-2xl">🤖</div>
						<div>
							<h1 className="font-bold text-gray-800 text-xl">Text to SQL</h1>
							<p className="text-gray-600 text-sm">智能自然语言转 SQL 系统</p>
						</div>
					</div>

					{/* 导航标签 */}
					<div className="flex items-center gap-2">
						{navItems.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => !item.disabled && setCurrentView(item.id)}
								disabled={item.disabled}
								className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
									currentView === item.id
										? "bg-blue-500 text-white"
										: item.disabled
											? "cursor-not-allowed bg-gray-100 text-gray-400"
											: "bg-gray-100 text-gray-700 hover:bg-gray-200"
								}
                `}
								title={
									item.disabled ? "请先生成 PreSQL 和 SQL" : item.description
								}
							>
								{item.label}
							</button>
						))}
					</div>
				</div>

				{/* 进度指示器 */}
				{currentSession && (
					<div className="pb-4">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<div className="h-3 w-3 rounded-full bg-green-500" />
								<span className="text-gray-600 text-sm">PreSQL 已生成</span>
							</div>

							{currentSession.status === "sql-generating" && (
								<div className="flex items-center gap-2">
									<div className="h-3 w-3 animate-pulse rounded-full bg-yellow-500" />
									<span className="text-gray-600 text-sm">正在生成 SQL...</span>
								</div>
							)}

							{currentSession.sqlResult && (
								<div className="flex items-center gap-2">
									<div className="h-3 w-3 rounded-full bg-green-500" />
									<span className="text-gray-600 text-sm">SQL 已生成</span>
								</div>
							)}

							{currentSession.status === "error" && (
								<div className="flex items-center gap-2">
									<div className="h-3 w-3 rounded-full bg-red-500" />
									<span className="text-red-600 text-sm">生成失败</span>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
