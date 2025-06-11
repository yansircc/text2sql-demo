"use client";

import { InputForm } from "@/app/_components/input-form";
import { Navigation } from "@/app/_components/navigation";
import { SessionSidebar } from "@/app/_components/session-sidebar";
import { ShowResults } from "@/app/_components/show-results";
import { SQLResultView } from "@/app/_components/sql-result-view";
import type { PreSQL } from "@/server/api/routers/pre-sql";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/trpc/react";
import { generateJsonSchema } from "@/types/db.schema";
import { useState } from "react";

export function AiChatDemo() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<
		Array<{
			query: string;
			preSQL: PreSQL;
			timestamp: string;
		}>
	>([]);

	const {
		currentView,
		currentSession,
		addSession,
		updateCurrentSession,
		setCurrentView,
	} = useAppStore();

	// PreSQL 生成
	const generatePreSQLMutation = api.preSQL.generatePreSQL.useMutation({
		onSuccess: (data) => {
			// 添加结果到历史记录
			setResults((prev) => [
				{
					query,
					preSQL: data.preSQL,
					timestamp: data.processingTime,
				},
				...prev,
			]);

			// 创建新的会话
			const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			const newSession = {
				id: sessionId,
				originalQuery: query,
				preSQL: data.preSQL,
				timestamp: data.processingTime,
				status: "preSQL-generated" as const,
			};

			addSession(newSession);
		},
		onError: (error) => {
			console.error("PreSQL 生成错误:", error);
			// 添加错误结果
			setResults((prev) => [
				{
					query,
					preSQL: {
						error: error.message,
						difficulty: "medium",
						difficultyReason: "",
						tablesAndFields: "",
						selectedTables: [],
						analysisSteps: [],
						needsSemanticSearch: false,
						queryType: "",
						sqlHints: {
							orderBy: [],
							groupBy: [],
							limit: undefined,
							aggregations: [],
							joins: [],
						},
					},
					timestamp: new Date().toISOString(),
				},
				...prev,
			]);
		},
	});

	// 精简 Schema 生成
	const generateSlimSchemaMutation = api.preSQL.generateSlimSchema.useMutation({
		onSuccess: (data) => {
			// 更新当前会话的精简 schema
			updateCurrentSession({
				slimSchema: data.slimSchema,
			});

			// 立即开始生成 SQL
			if (currentSession) {
				generateSQLMutation.mutate({
					preSQL: currentSession.preSQL,
					slimSchema: JSON.stringify(data.slimSchema),
				});
			}
		},
		onError: (error) => {
			console.error("精简Schema生成错误:", error);
			updateCurrentSession({
				status: "error",
				error: error.message,
			});
		},
	});

	// SQL 生成 - 适应简化后的 API
	const generateSQLMutation = api.genSQL.generateSQL.useMutation({
		onSuccess: (data) => {
			// 更新当前会话，只保存 SQL 语句
			updateCurrentSession({
				sqlResult: {
					sql: data.sql,
				},
				status: "sql-generated",
			});

			// 自动切换到结果视图
			setCurrentView("result");
		},
		onError: (error) => {
			console.error("SQL 生成错误:", error);
			updateCurrentSession({
				status: "error",
				error: error.message,
			});
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!query.trim()) return;

		// 生成数据库 schema
		const databaseSchema = generateJsonSchema();

		// 发送请求生成 PreSQL
		generatePreSQLMutation.mutate({
			naturalLanguageQuery: query.trim(),
			databaseSchema: JSON.stringify(databaseSchema),
			context:
				"这是一个基于小满CRM系统的数据库，包含公司客户、联系人、业务员、跟进动态、商机、WhatsApp消息等模块。主要用于客户关系管理和销售跟进。",
		});

		setQuery("");
	}

	// 生成 SQL 的处理函数
	const handleGenerateSQL = () => {
		if (!currentSession?.preSQL.selectedTables?.length) {
			alert("请先生成 PreSQL 并确保选择了相关表");
			return;
		}

		// 更新状态为生成中
		updateCurrentSession({
			status: "sql-generating",
		});

		// 生成完整的数据库 schema
		const databaseSchema = generateJsonSchema();

		// 先生成精简 schema
		generateSlimSchemaMutation.mutate({
			selectedTables: currentSession.preSQL.selectedTables,
			fullDatabaseSchema: JSON.stringify(databaseSchema),
		});
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<Navigation />

			<div className="flex h-[calc(100vh-4rem)]">
				{/* 侧边栏 */}
				<div className="w-80 flex-shrink-0">
					<SessionSidebar />
				</div>

				{/* 主内容区域 */}
				<div className="flex-1 overflow-auto">
					<div className="mx-auto max-w-5xl px-6 py-6">
						{currentView === "input" && (
							<div className="space-y-6">
								<div className="rounded-lg bg-white p-6 shadow-lg">
									<h1 className="mb-6 font-bold text-3xl text-gray-800">
										🤖 Text to SQL 智能生成系统
									</h1>

									{/* 输入区域 */}
									<div className="mb-6 rounded-lg border-2 border-gray-300 border-dashed p-4">
										<h2 className="mb-4 font-semibold text-gray-700 text-lg">
											📝 输入自然语言查询
										</h2>
										<InputForm
											handleSubmit={handleSubmit}
											query={query}
											setQuery={setQuery}
											generatePreSQLMutation={generatePreSQLMutation}
										/>
									</div>

									{/* 数据库 Schema 信息 */}
									<div className="mb-6 rounded-lg bg-gray-50 p-4">
										<h3 className="mb-2 font-semibold text-gray-700">
											📊 数据库 Schema
										</h3>
										<div className="grid grid-cols-2 gap-4 text-sm">
											<div>
												<strong>核心表：</strong>
												<ul className="mt-1 list-inside list-disc text-gray-600">
													<li>companies (公司客户表)</li>
													<li>contacts (联系人表)</li>
													<li>salesUsers (业务员表)</li>
													<li>companyUserRelations (关系表)</li>
												</ul>
											</div>
											<div>
												<strong>业务表：</strong>
												<ul className="mt-1 list-inside list-disc text-gray-600">
													<li>followUps (跟进动态表)</li>
													<li>opportunities (商机表)</li>
													<li>whatsappMessages (消息表)</li>
												</ul>
											</div>
										</div>
									</div>

									{/* 生成 SQL 按钮 */}
									{currentSession &&
										currentSession.status === "preSQL-generated" && (
											<div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-green-50 p-6">
												<div className="flex items-center justify-between">
													<div>
														<h3 className="mb-2 font-semibold text-gray-800 text-lg">
															🚀 准备生成 SQL
														</h3>
														<p className="text-gray-600">
															PreSQL 分析已完成，现在可以生成最终的 SQL 语句
														</p>
													</div>
													<button
														type="button"
														onClick={handleGenerateSQL}
														disabled={
															generateSlimSchemaMutation.isPending ||
															generateSQLMutation.isPending
														}
														className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
													>
														{generateSlimSchemaMutation.isPending ||
														generateSQLMutation.isPending
															? "🔄 生成中..."
															: "🎯 生成 SQL"}
													</button>
												</div>
											</div>
										)}
								</div>

								{/* 结果展示区域 */}
								{results.length > 0 && <ShowResults results={results} />}

								{/* 使用说明 */}
								<div className="rounded-lg bg-blue-50 p-4 text-blue-800">
									<h3 className="mb-2 font-semibold">💡 使用说明</h3>
									<ul className="list-inside list-disc space-y-1 text-sm">
										<li>输入自然语言查询，系统会生成 PreSQL 分析</li>
										<li>
											<strong>智能表字段选择：</strong>
											自动精选相关表和字段，减少噪音
										</li>
										<li>
											<strong>完整流程：</strong> 自然语言 → PreSQL 分析 → SQL
											生成 → 结果展示
										</li>
										<li>支持复杂查询、时间处理、语义搜索等功能</li>
										<li>左侧可查看历史查询和快速切换会话</li>
									</ul>
								</div>
							</div>
						)}

						{currentView === "result" && <SQLResultView />}
					</div>
				</div>
			</div>
		</div>
	);
}
