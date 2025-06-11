interface QueryInputProps {
	query: string;
	onQueryChange: (query: string) => void;
}

export function QueryInput({ query, onQueryChange }: QueryInputProps) {
	return (
		<div style={{ marginBottom: "20px" }}>
			<textarea
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
				placeholder="输入你的查询..."
				style={{
					width: "100%",
					height: "100px",
					padding: "10px",
					fontSize: "14px",
					border: "1px solid #ccc",
				}}
			/>
		</div>
	);
}
