import { exampleQueries } from "./constants";

interface ExampleQueriesProps {
	onQuerySelect: (query: string) => void;
}

export function ExampleQueries({ onQuerySelect }: ExampleQueriesProps) {
	return (
		<div
			style={{
				marginTop: "40px",
				borderTop: "1px solid #ccc",
				paddingTop: "20px",
			}}
		>
			<h3>示例查询:</h3>
			<ul>
				{exampleQueries.map((example) => (
					<li key={example.text}>
						<button
							onClick={() => onQuerySelect(example.text)}
							style={{
								textDecoration: "underline",
								cursor: "pointer",
								border: "none",
								background: "none",
							}}
						>
							{example.label}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
