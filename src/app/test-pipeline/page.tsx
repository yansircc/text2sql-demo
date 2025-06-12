"use client";

import { ExampleQueries } from "./queries";
import { QueryInput } from "./query-input";
import { ResultDisplay } from "./result-display";
import { usePipeline } from "./use-pipeline";

export default function TestPipelinePage() {
	const { query, setQuery, results, executeQuery, clearResults, isLoading } =
		usePipeline();

	return (
		<div
			style={{
				padding: "20px",
				fontFamily: "system-ui, sans-serif",
				maxWidth: "1200px",
				margin: "0 auto",
			}}
		>
			<h1 style={{ fontFamily: "monospace", marginBottom: "30px" }}>
				Text2SQL 查询工作流
			</h1>

			<div
				style={{
					marginBottom: "20px",
					padding: "15px",
					backgroundColor: "#e3f2fd",
					borderRadius: "8px",
					fontSize: "14px",
				}}
			>
				<strong>🚀 CloudFlare Workflow 兼容架构</strong>
				<div style={{ marginTop: "5px", color: "#555" }}>
					将自然语言查询转换为SQL并执行，支持向量搜索、SQL查询和混合搜索模式
				</div>
			</div>

			<ExampleQueries onQuerySelect={setQuery} />

			<QueryInput query={query} onQueryChange={setQuery} />

			<div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
				<button
					type="button"
					onClick={executeQuery}
					disabled={!query || isLoading}
					style={{
						padding: "12px 24px",
						cursor: !query || isLoading ? "not-allowed" : "pointer",
						opacity: !query || isLoading ? 0.5 : 1,
						backgroundColor: "#2196F3",
						color: "white",
						fontWeight: "bold",
						fontSize: "16px",
						borderRadius: "6px",
						border: "none",
						display: "flex",
						alignItems: "center",
						gap: "8px",
					}}
				>
					{isLoading ? (
						<>
							<span
								style={{
									display: "inline-block",
									width: "16px",
									height: "16px",
									border: "2px solid #fff",
									borderTopColor: "transparent",
									borderRadius: "50%",
									animation: "spin 0.8s linear infinite",
								}}
							/>
							处理中...
						</>
					) : (
						<>⚡ 执行查询</>
					)}
				</button>

				<button
					type="button"
					onClick={clearResults}
					disabled={isLoading}
					style={{
						padding: "12px 24px",
						cursor: isLoading ? "not-allowed" : "pointer",
						opacity: isLoading ? 0.5 : 1,
						backgroundColor: "#f44336",
						color: "white",
						borderRadius: "6px",
						border: "none",
						fontWeight: "500",
					}}
				>
					清除结果
				</button>
			</div>

			<ResultDisplay results={results} />

			<style jsx>{`
				@keyframes spin {
					to { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	);
}
