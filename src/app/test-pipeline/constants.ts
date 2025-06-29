import { FieldFilters, generateJsonSchema } from "@/types/db.schema";
import {
	type Difficulty,
	hybrid,
	lv1,
	lv2,
	lv3,
	lv4,
	lv5,
	lv6,
	lv7,
	nonsense,
	semantic,
} from "./test-library";

// 使用真实的数据库 schema
export const DatabaseSchema = JSON.stringify(generateJsonSchema());

// 动态生成向量化字段的 schema
export const VectorizedDatabaseSchema = generateJsonSchema({
	fieldFilter: FieldFilters.vectorizedOnly,
	includeEmptyTables: false,
});

// 查询任务接口定义
export interface QueryTask {
	id: string;
	text: string;
	difficulty: Difficulty;
	category: string;
	description: string;
	tables: string[];
}

// 按复杂度分类的查询任务
export const queryTasks: Record<number, QueryTask[]> = {
	// 1表查询 - 基础数据统计和筛选
	1: lv1,

	// 2表查询 - 简单关联分析
	2: lv2,

	// 3表查询 - 中等复杂度业务分析
	3: lv3,

	// 4表查询 - 复杂业务场景分析
	4: lv4,

	// 5表查询 - 高级综合分析
	5: lv5,

	// 6表查询 - 企业级深度分析
	6: lv6,

	// 7表查询 - 全景式战略分析
	7: lv7,

	// 无效查询
	20: nonsense,

	// 语义查询
	21: semantic,

	// 混合查询
	22: hybrid,
};

// 获取所有任务的扁平化数组
export const allTasks: QueryTask[] = Object.values(queryTasks).flat();

// 按难度获取任务
export function getTasksByDifficulty(difficulty: Difficulty): QueryTask[] {
	return queryTasks[difficulty] || [];
}

// 按类别获取任务
export function getTasksByCategory(category: string): QueryTask[] {
	return allTasks.filter((task) => task.category === category);
}

// 获取所有类别
export function getAllCategories(): string[] {
	return [...new Set(allTasks.map((task) => task.category))];
}

// 获取随机任务
export function getRandomTask(difficulty?: Difficulty): QueryTask {
	const tasks = difficulty ? getTasksByDifficulty(difficulty) : allTasks;
	if (tasks.length === 0) {
		throw new Error(`No tasks available for difficulty ${difficulty || "any"}`);
	}
	const randomIndex = Math.floor(Math.random() * tasks.length);
	return tasks[randomIndex]!;
}

// 获取多个随机任务（不重复）
export function getRandomTasks(
	count: number,
	difficulty?: Difficulty,
): QueryTask[] {
	const tasks = difficulty ? getTasksByDifficulty(difficulty) : allTasks;
	const shuffled = [...tasks].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, Math.min(count, tasks.length));
}

// 任务统计信息
export const taskStats = {
	total: allTasks.length,
	byDifficulty: Object.fromEntries(
		Object.entries(queryTasks).map(([key, tasks]) => [key, tasks.length]),
	),
	byCategory: Object.fromEntries(
		getAllCategories().map((category) => [
			category,
			getTasksByCategory(category).length,
		]),
	),
};

export const WORKFLOW_STAGES = {
	INIT: "init",
	ANALYZING: "analyzing",
	VECTOR_SEARCH: "vector_search",
	SCHEMA_SELECTION: "schema_selection",
	SQL_GENERATION: "sql_generation",
	SQL_EXECUTION: "sql_execution",
	RESULT_FUSION: "result_fusion",
	COMPLETE: "complete",
	ERROR: "error",
} as const;

// 将 VectorizedDatabaseSchema 转换为 vectorizedFields 映射格式
export function getVectorizedFieldsMap(): Record<string, string[]> {
	const fieldsMap: Record<string, string[]> = {};

	// 遍历所有表
	for (const [tableName, tableSchema] of Object.entries(
		VectorizedDatabaseSchema,
	)) {
		const vectorizedFields: string[] = [];

		// 遍历表中的所有字段
		if (tableSchema.properties) {
			for (const [fieldName, fieldSchema] of Object.entries(
				tableSchema.properties,
			)) {
				// 检查字段是否被向量化
				if (
					fieldSchema &&
					typeof fieldSchema === "object" &&
					"isVectorized" in fieldSchema &&
					fieldSchema.isVectorized === true
				) {
					vectorizedFields.push(fieldName);
				}
			}
		}

		// 只添加有向量化字段的表
		if (vectorizedFields.length > 0) {
			fieldsMap[tableName] = vectorizedFields;
		}
	}

	return fieldsMap;
}

// 导出预计算的向量化字段映射（可选，用于性能优化）
export const VectorizedFieldsMap = getVectorizedFieldsMap();
