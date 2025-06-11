"use client";

import { useAppStore } from "@/store/useAppStore";

export function SessionSidebar() {
	const {
		sessions,
		currentSession,
		setCurrentSession,
		currentView,
		setCurrentView,
	} = useAppStore();

	const handleSessionClick = (session: any) => {
		setCurrentSession(session);
		// 如果该会话有 SQL 结果，可以直接跳转到结果页
		if (session.sqlResult) {
			setCurrentView("result");
		} else {
			setCurrentView("input");
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "preSQL-generated":
				return "📝";
			case "sql-generating":
				return "⏳";
			case "sql-generated":
				return "✅";
			case "error":
				return "❌";
			default:
				return "📄";
		}
	};

	const getStatusText = (status: string) => {
		switch (status) {
			case "preSQL-generated":
				return "PreSQL 已生成";
			case "sql-generating":
				return "生成中...";
			case "sql-generated":
				return "SQL 已生成";
			case "error":
				return "生成失败";
			default:
				return "未知状态";
		}
	};

	if (sessions.length === 0) {
		return (
			<div className="h-full border-r bg-white p-4">
				<h3 className="mb-4 font-semibold text-gray-700">📚 会话历史</h3>
				<div className="text-center text-gray-500 text-sm">
					<div className="mb-2 text-4xl">📝</div>
					<div>还没有任何查询</div>
					<div>开始你的第一个查询吧！</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full border-r bg-white">
			<div className="border-b p-4">
				<h3 className="font-semibold text-gray-700">📚 会话历史</h3>
				<div className="mt-1 text-gray-500 text-xs">
					共 {sessions.length} 个会话
				</div>
			</div>

			<div className="h-full overflow-y-auto">
				{sessions.map((session) => (
					<button
						type="button"
						key={session.id}
						onClick={() => handleSessionClick(session)}
						className={`w-full cursor-pointer border-b p-4 text-left transition-colors hover:bg-gray-50 ${currentSession?.id === session.id ? "border-l-4 border-l-blue-500 bg-blue-50" : ""}`}
					>
						<div className="mb-2 flex items-start justify-between">
							<div className="flex items-center gap-2">
								<span className="text-lg">{getStatusIcon(session.status)}</span>
								<div className="text-gray-500 text-xs">
									{new Date(session.timestamp).toLocaleDateString()}
								</div>
							</div>
							{session.status === "sql-generating" && (
								<div className="animate-spin text-blue-500">⚙️</div>
							)}
						</div>

						<div className="mb-2 line-clamp-2 text-gray-800 text-sm">
							"{session.originalQuery}"
						</div>

						<div className="flex items-center justify-between">
							<div
								className={`rounded-full px-2 py-1 text-xs ${
									session.status === "sql-generated"
										? "bg-green-100 text-green-700"
										: session.status === "sql-generating"
											? "bg-yellow-100 text-yellow-700"
											: session.status === "error"
												? "bg-red-100 text-red-700"
												: "bg-blue-100 text-blue-700"
								}`}
							>
								{getStatusText(session.status)}
							</div>

							{session.preSQL.selectedTables?.length > 0 && (
								<div className="text-gray-500 text-xs">
									{session.preSQL.selectedTables.length} 表
								</div>
							)}
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
