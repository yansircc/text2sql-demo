import { env } from "../env";
import * as schema from "../server/db/schema";
import { FieldFilters, generateJsonSchema } from "../types/db.schema";
import { universalVectorize } from "./universal-vectorizer";

/**
 * 自动向量化所有标记为 isVectorized 的字段
 *
 * 这个脚本会：
 * 1. 使用 generateJsonSchema 获取所有向量化字段
 * 2. 对每个包含向量化字段的表执行向量化
 * 3. 使用同一个集合存储所有向量
 */

interface VectorizedField {
	fieldName: string;
	description: string;
}

interface TableVectorConfig {
	tableName: string;
	tableSchema: any;
	vectorFields: VectorizedField[];
}

async function getAllVectorizedTables(): Promise<TableVectorConfig[]> {
	console.log("🔍 分析数据库schema，查找所有向量化字段...");

	// 获取只包含向量化字段的schema
	const vectorizedSchema = generateJsonSchema({
		fieldFilter: FieldFilters.vectorizedOnly,
		includeEmptyTables: false,
	});

	const tableConfigs: TableVectorConfig[] = [];

	// 遍历所有表
	for (const [tableName, tableDefinition] of Object.entries(vectorizedSchema)) {
		// 获取原始表名（去掉 text2sql_ 前缀）
		const originalTableName = tableName.replace("text2sql_", "");

		// 从 schema 导出中获取对应的 Drizzle 表定义
		const drizzleTableName = originalTableName
			.split("_")
			.map((part, index) =>
				index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
			)
			.join("");

		const tableSchema = (schema as any)[drizzleTableName];

		if (!tableSchema) {
			console.warn(`⚠️  找不到表定义: ${drizzleTableName}`);
			continue;
		}

		// 提取向量化字段
		const vectorFields: VectorizedField[] = [];
		const properties = (tableDefinition as any).properties || {};

		for (const [fieldName, fieldDef] of Object.entries(properties)) {
			if ((fieldDef as any).isVectorized) {
				vectorFields.push({
					fieldName,
					description: (fieldDef as any).description || fieldName,
				});
			}
		}

		if (vectorFields.length > 0) {
			tableConfigs.push({
				tableName: originalTableName,
				tableSchema,
				vectorFields,
			});
		}
	}

	return tableConfigs;
}

async function vectorizeAllTables() {
	console.log("🚀 开始自动向量化所有标记的字段");
	console.log("=".repeat(60));

	const startTime = Date.now();
	const baseCollectionName = env.QDRANT_DEFAULT_COLLECTION;

	try {
		// 获取所有需要向量化的表配置
		const tableConfigs = await getAllVectorizedTables();

		console.log(`\n📊 发现 ${tableConfigs.length} 个包含向量化字段的表：`);
		for (const config of tableConfigs) {
			console.log(
				`  - ${config.tableName}: ${config.vectorFields.length} 个字段`,
			);
			console.log(
				`    字段: ${config.vectorFields.map((f) => f.fieldName).join(", ")}`,
			);
		}

		// 统计信息
		const stats = {
			totalTables: tableConfigs.length,
			totalFields: tableConfigs.reduce(
				(sum, cfg) => sum + cfg.vectorFields.length,
				0,
			),
			processedRecords: 0,
			skippedRecords: 0,
			totalVectors: 0,
		};

		// 逐个表进行向量化
		for (const [index, config] of tableConfigs.entries()) {
			console.log(`\n${"=".repeat(60)}`);
			console.log(
				`📋 处理表 ${index + 1}/${tableConfigs.length}: ${config.tableName}`,
			);
			console.log(`${"=".repeat(60)}`);

			try {
				// 为每个表创建独立的集合
				const tableCollectionName = `${baseCollectionName}-${config.tableName}`;
				console.log(`📦 使用集合: ${tableCollectionName}`);

				const result = await universalVectorize({
					tableName: config.tableName,
					tableSchema: config.tableSchema,
					collectionName: tableCollectionName, // 使用表专属的集合名
					idField: getIdFieldForTable(config.tableName),
					textFields: config.vectorFields.map((f) => f.fieldName),
					batchSize: 100,
					resumeMode: true, // 启用断点续传
				});

				// 更新统计
				stats.processedRecords += result.processedRecords;
				stats.skippedRecords +=
					result.skippedRecords + (result.resumeSkippedRecords || 0);
				stats.totalVectors += result.totalVectors;

				console.log(`\n✅ ${config.tableName} 表向量化完成`);
				console.log(`  - 处理记录: ${result.processedRecords}`);
				console.log(
					`  - 跳过记录: ${result.skippedRecords + (result.resumeSkippedRecords || 0)}`,
				);
				console.log(`  - 生成向量: ${result.totalVectors}`);
			} catch (error) {
				console.error(`\n❌ ${config.tableName} 表向量化失败:`, error);
			}
		}

		// 打印总结
		const totalTime = Date.now() - startTime;
		console.log(`\n${"=".repeat(60)}`);
		console.log("🎉 所有表向量化完成！");
		console.log(`${"=".repeat(60)}`);
		console.log("📊 总体统计：");
		console.log(`  - 处理表数: ${stats.totalTables}`);
		console.log(`  - 向量化字段总数: ${stats.totalFields}`);
		console.log(`  - 处理记录总数: ${stats.processedRecords}`);
		console.log(`  - 跳过记录总数: ${stats.skippedRecords}`);
		console.log(`  - 生成向量总数: ${stats.totalVectors}`);
		console.log(`  - 总耗时: ${(totalTime / 1000).toFixed(2)} 秒`);

		return stats;
	} catch (error) {
		console.error("❌ 向量化过程出错:", error);
		throw error;
	}
}

// 根据表名获取对应的ID字段
function getIdFieldForTable(tableName: string): string {
	const idFieldMap: Record<string, string> = {
		companies: "companyId",
		contacts: "customerId",
		salesUsers: "userId",
		companyUserRelations: "id",
		followUps: "followUpId",
		opportunities: "opportunityId",
		whatsappMessages: "messageId",
	};

	return idFieldMap[tableName] || "id";
}

// 导出函数
export { vectorizeAllTables, getAllVectorizedTables };

// 如果直接运行此脚本
if (import.meta.main) {
	vectorizeAllTables()
		.then(() => {
			console.log("\n✅ 脚本执行完成");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n❌ 脚本执行失败:", error);
			process.exit(1);
		});
}
