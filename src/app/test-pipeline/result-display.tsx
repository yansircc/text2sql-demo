import type { PipelineResults } from "./types";

interface ResultDisplayProps {
	results: PipelineResults;
}

// 极简的步骤结果展示
function MinimalStepResult({
	stepName,
	data,
	status,
}: {
	stepName: string;
	data: any;
	status?: "success" | "error" | "pending";
}) {
	const bgColor =
		status === "error" ? "#fee" : status === "pending" ? "#ffd" : "#efe";

	return (
		<div
			style={{
				marginBottom: "12px",
				padding: "12px",
				backgroundColor: bgColor,
				borderRadius: "4px",
				border: "1px solid #ddd",
			}}
		>
			<div
				style={{
					fontWeight: "bold",
					marginBottom: "8px",
					color: status === "error" ? "#d00" : "#333",
				}}
			>
				{stepName}
			</div>
			{data && (
				<pre
					style={{
						margin: 0,
						fontSize: "12px",
						fontFamily: "Monaco, monospace",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
					}}
				>
					{JSON.stringify(data, null, 2)}
				</pre>
			)}
		</div>
	);
}

export function ResultDisplay({ results }: ResultDisplayProps) {
	if (!results.workflow) {
		return null;
	}

	const wf = results.workflow;

	// 错误状态
	if (wf.status === "failed" && wf.error) {
		return (
			<div
				style={{
					marginTop: "20px",
					padding: "16px",
					backgroundColor: "#ffebee",
					borderRadius: "8px",
					border: "1px solid #ef5350",
				}}
			>
				<div
					style={{ fontWeight: "bold", color: "#c62828", marginBottom: "8px" }}
				>
					❌ 查询失败
				</div>
				<div style={{ color: "#d32f2f" }}>{wf.error}</div>
				{wf.suggestions && wf.suggestions.length > 0 && (
					<div style={{ marginTop: "12px" }}>
						<div style={{ fontWeight: "600", marginBottom: "4px" }}>建议：</div>
						<ul style={{ margin: 0, paddingLeft: "20px" }}>
							{wf.suggestions.map((s, i) => (
								<li key={i}>{s}</li>
							))}
						</ul>
					</div>
				)}
			</div>
		);
	}

	// 成功状态
	return (
		<div style={{ marginTop: "20px" }}>
			{/* 概览信息 */}
			<div
				style={{
					marginBottom: "16px",
					padding: "12px",
					backgroundColor: "#f5f5f5",
					borderRadius: "6px",
					fontSize: "14px",
				}}
			>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "auto 1fr",
						gap: "8px",
					}}
				>
					<strong>查询ID:</strong>{" "}
					<span style={{ fontFamily: "monospace", fontSize: "12px" }}>
						{wf.queryId}
					</span>
					<strong>策略:</strong>{" "}
					<span>
						{wf.strategy === "sql_only"
							? "SQL查询"
							: wf.strategy === "vector_only"
								? "向量搜索"
								: wf.strategy === "hybrid"
									? "混合搜索"
									: "已拒绝"}
					</span>
					<strong>状态:</strong>{" "}
					<span
						style={{ color: wf.status === "success" ? "#4caf50" : "#ff9800" }}
					>
						{wf.status === "success"
							? "成功"
							: wf.status === "partial"
								? "部分成功"
								: "失败"}
					</span>
					<strong>总耗时:</strong> <span>{wf.metadata?.totalTime || 0}ms</span>
					{wf.metadata?.cacheHits !== undefined &&
						wf.metadata.cacheHits > 0 && (
							<>
								<strong>缓存命中:</strong>{" "}
								<span style={{ color: "#4caf50" }}>
									{wf.metadata.cacheHits} 次
								</span>
							</>
						)}
					{wf.metadata?.sqlModel && (
						<>
							<strong>SQL模型:</strong> <span>{wf.metadata.sqlModel}</span>
						</>
					)}
					{wf.metadata?.sqlDifficulty && (
						<>
							<strong>查询难度:</strong>
							<span
								style={{
									color:
										wf.metadata.sqlDifficulty === "easy"
											? "#4caf50"
											: wf.metadata.sqlDifficulty === "hard"
												? "#ff9800"
												: wf.metadata.sqlDifficulty === "very_hard"
													? "#f44336"
													: wf.metadata.sqlDifficulty === "triple"
														? "#2196f3"
														: "#666",
								}}
							>
								{wf.metadata.sqlDifficulty === "easy"
									? "简单"
									: wf.metadata.sqlDifficulty === "hard"
										? "困难"
										: wf.metadata.sqlDifficulty === "very_hard"
											? "非常困难"
											: wf.metadata.sqlDifficulty === "cached"
												? "已缓存"
												: wf.metadata.sqlDifficulty === "triple"
													? "三重策略"
													: wf.metadata.sqlDifficulty}
							</span>
						</>
					)}
				</div>
			</div>

			{/* Triple SQL Voting Info */}
			{wf.metadata?.tripleVoting && (
				<div
					style={{
						marginBottom: "16px",
						padding: "12px",
						backgroundColor: "#e3f2fd",
						borderRadius: "6px",
						fontSize: "13px",
						border: "1px solid #2196f3",
					}}
				>
					<div style={{ fontWeight: "600", marginBottom: "8px", color: "#1976d2" }}>
						🗳️ 三重SQL策略投票结果
					</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
						{wf.metadata.tripleVoting.allResults.map((result: any) => (
							<div
								key={result.strategy}
								style={{
									padding: "8px",
									backgroundColor: result.strategy === wf.metadata.sqlModel ? "#bbdefb" : "#f5f5f5",
									borderRadius: "4px",
									border: result.strategy === wf.metadata.sqlModel ? "2px solid #1976d2" : "1px solid #ddd",
								}}
							>
								<div style={{ fontWeight: "600", textTransform: "capitalize" }}>
									{result.strategy}
									{result.strategy === wf.metadata.sqlModel && " ✅"}
								</div>
								<div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
									结果: {result.rowCount} 行
									{result.hasError && " ❌错误"}
								</div>
								<div style={{ fontSize: "12px", color: "#666" }}>
									得票: {wf.metadata.tripleVoting.votes[result.strategy] || 0}
								</div>
							</div>
						))}
					</div>
					<div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
						平均置信度: {(wf.metadata.tripleVoting.avgConfidence * 100).toFixed(1)}%
					</div>
				</div>
			)}

			{/* 执行步骤 */}
			{wf.metadata?.steps && wf.metadata.steps.length > 0 && (
				<div style={{ marginBottom: "16px" }}>
					<h3 style={{ fontSize: "16px", marginBottom: "12px" }}>执行步骤</h3>
					<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
						{wf.metadata.steps.map((step, idx) => {
							// Step name mapping for better display
							const stepDisplayNames: Record<string, string> = {
								QueryAnalysis: "查询分析",
								VectorSearch: "向量搜索",
								SchemaSelection: "Schema选择",
								SQLBuilding: "SQL构建",
								SQLExecution: "SQL执行",
								SQLErrorHandler: "SQL错误处理",
								SQLExecutionCorrected: "SQL重新执行",
								ResultFusion: "结果融合",
							};

							const displayName = stepDisplayNames[step.name] || step.name;
							const isParallel =
								(step.name === "VectorSearch" ||
									step.name === "SchemaSelection") &&
								wf.strategy === "hybrid";

							return (
								<div
									key={idx}
									style={{
										padding: "8px 12px",
										backgroundColor:
											step.status === "success"
												? "#e8f5e9"
												: step.status === "failed"
													? "#ffebee"
													: "#fff3e0",
										borderRadius: "4px",
										fontSize: "13px",
										border: `1px solid ${step.status === "success" ? "#4caf50" : step.status === "failed" ? "#f44336" : "#ff9800"}`,
										position: "relative",
									}}
								>
									<div style={{ fontWeight: "600" }}>
										{displayName}
										{isParallel && (
											<span
												style={{
													fontSize: "10px",
													marginLeft: "4px",
													backgroundColor: "#2196f3",
													color: "white",
													padding: "1px 4px",
													borderRadius: "3px",
													verticalAlign: "middle",
												}}
											>
												并行
											</span>
										)}
										{step.cached && (
											<span
												style={{
													fontSize: "10px",
													marginLeft: "4px",
													backgroundColor: "#4caf50",
													color: "white",
													padding: "1px 4px",
													borderRadius: "3px",
													verticalAlign: "middle",
												}}
											>
												缓存
											</span>
										)}
									</div>
									<div
										style={{
											fontSize: "11px",
											color: "#666",
											marginTop: "2px",
										}}
									>
										{step.time}ms
									</div>
									{step.error && (
										<div
											style={{
												fontSize: "11px",
												color: "#d32f2f",
												marginTop: "2px",
												maxWidth: "200px",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
											title={step.error}
										>
											❌ {step.error}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* SQL语句 */}
			{wf.metadata?.sql && (
				<MinimalStepResult
					stepName="生成的SQL"
					data={wf.metadata.sql}
					status="success"
				/>
			)}

			{/* 查询结果 */}
			{wf.data && wf.data.length > 0 && (
				<div>
					<h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
						查询结果 ({wf.rowCount || wf.data.length} 条记录)
					</h3>
					<div
						style={{
							backgroundColor: "#fff",
							border: "1px solid #ddd",
							borderRadius: "4px",
							overflow: "auto",
							maxHeight: "400px",
						}}
					>
						<table
							style={{
								width: "100%",
								borderCollapse: "collapse",
								fontSize: "13px",
							}}
						>
							<thead>
								<tr style={{ backgroundColor: "#f5f5f5" }}>
									{wf.data[0] &&
										Object.keys(wf.data[0]).map((key) => (
											<th
												key={key}
												style={{
													padding: "8px",
													borderBottom: "2px solid #ddd",
													textAlign: "left",
													position: "sticky",
													top: 0,
													backgroundColor: "#f5f5f5",
												}}
											>
												{key}
											</th>
										))}
								</tr>
							</thead>
							<tbody>
								{wf.data.slice(0, 50).map((row, idx) => (
									<tr
										key={idx}
										style={{
											backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
										}}
									>
										{Object.values(row).map((value, vIdx) => (
											<td
												key={vIdx}
												style={{
													padding: "8px",
													borderBottom: "1px solid #eee",
												}}
											>
												{typeof value === "object"
													? JSON.stringify(value)
													: String(value)}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
						{wf.data.length > 50 && (
							<div
								style={{
									padding: "8px",
									textAlign: "center",
									backgroundColor: "#f5f5f5",
									borderTop: "1px solid #ddd",
									fontSize: "12px",
									color: "#666",
								}}
							>
								仅显示前 50 条记录
							</div>
						)}
					</div>
				</div>
			)}

			{/* 向量搜索统计 */}
			{wf.metadata?.vectorSearchCount !== undefined && (
				<div
					style={{
						marginTop: "12px",
						padding: "8px",
						backgroundColor: "#f5f5f5",
						borderRadius: "4px",
						fontSize: "13px",
					}}
				>
					向量搜索找到 {wf.metadata.vectorSearchCount} 个相关结果
					{wf.metadata.fusionMethod &&
						` (使用 ${wf.metadata.fusionMethod.toUpperCase()} 融合算法)`}
				</div>
			)}
		</div>
	);
}
