export function ProcessDescription() {
	return (
		<div
			style={{
				backgroundColor: "#f0f0f0",
				padding: "15px",
				marginBottom: "20px",
				borderRadius: "5px",
				fontSize: "14px",
			}}
		>
			<strong>处理流程：</strong>
			<ol>
				<li>
					<strong>Pre-Handle</strong>: 快速分析查询，识别需要的表（不分析字段）
					<ul style={{ fontSize: "13px", color: "#666", marginTop: "5px" }}>
						<li>输入：用户查询 + 完整数据库 schema</li>
						<li>输出：需要的表列表、处理决策</li>
					</ul>
				</li>
				<li>
					<strong>Pre-SQL</strong>: 基于预选的表，选择具体字段并生成SQL提示
					<ul style={{ fontSize: "13px", color: "#666", marginTop: "5px" }}>
						<li>输入：用户查询 + 仅相关表的 schema</li>
						<li>输出：精确的表字段选择、SQL 生成提示</li>
					</ul>
				</li>
				<li>
					<strong>Slim Schema</strong>: 生成精简的 Schema（仅包含需要的字段）
					<ul style={{ fontSize: "13px", color: "#666", marginTop: "5px" }}>
						<li>输入：选中的表和字段列表</li>
						<li>输出：极度精简的 schema</li>
					</ul>
				</li>
				<li>
					<strong>Gen SQL</strong>: 生成最终的 SQL 语句
					<ul style={{ fontSize: "13px", color: "#666", marginTop: "5px" }}>
						<li>输入：PreSQL 分析结果 + 精简 schema</li>
						<li>输出：可执行的 SQL 语句</li>
					</ul>
				</li>
			</ol>
			<p style={{ margin: "10px 0 0 0", color: "#666" }}>
				<strong>优势</strong>
				：通过逐步精简上下文，每个步骤都只接收必要的信息，大幅提高准确性和效率
			</p>
		</div>
	);
}
