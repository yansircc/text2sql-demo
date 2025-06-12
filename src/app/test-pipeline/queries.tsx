import { getRandomTask, taskStats } from "./constants";
import type { Difficulty } from "./test-library";

interface ExampleQueriesProps {
	onQuerySelect: (query: string) => void;
}

export function ExampleQueries({ onQuerySelect }: ExampleQueriesProps) {
	const handleRandomTask = (difficulty?: Difficulty) => {
		const task = getRandomTask(difficulty);
		onQuerySelect(task.text);
	};

	return (
		<div style={{ marginBottom: "20px" }}>
			<h3>随机查询任务:</h3>
			<div
				style={{
					backgroundColor: "#f5f5f5",
					padding: "10px",
					display: "flex",
					flexWrap: "wrap",
					gap: "10px",
				}}
			>
				<button
					onClick={() => handleRandomTask()}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					随机 ({taskStats.total} 个任务)
				</button>

				<button
					onClick={() => handleRandomTask(20)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					无效查询({taskStats.byDifficulty[20]}个)
				</button>

				<button
					onClick={() => handleRandomTask(21)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					语义查询({taskStats.byDifficulty[21]}个)
				</button>

				<button
					onClick={() => handleRandomTask(22)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					混合查询({taskStats.byDifficulty[22]}个)
				</button>

				<button
					onClick={() => handleRandomTask(1)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					1表({taskStats.byDifficulty[1]}个)
				</button>

				<button
					onClick={() => handleRandomTask(2)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					2表({taskStats.byDifficulty[2]}个)
				</button>

				<button
					onClick={() => handleRandomTask(3)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					3表({taskStats.byDifficulty[3]}个)
				</button>

				<button
					onClick={() => handleRandomTask(4)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					4表({taskStats.byDifficulty[4]}个)
				</button>

				<button
					onClick={() => handleRandomTask(5)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					5表({taskStats.byDifficulty[5]}个)
				</button>

				<button
					onClick={() => handleRandomTask(6)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					6表({taskStats.byDifficulty[6]}个)
				</button>

				<button
					onClick={() => handleRandomTask(7)}
					style={{
						padding: "8px 16px",
						border: "1px solid #ccc",
						backgroundColor: "white",
						cursor: "pointer",
					}}
				>
					7表({taskStats.byDifficulty[7]}个)
				</button>
			</div>
		</div>
	);
}
