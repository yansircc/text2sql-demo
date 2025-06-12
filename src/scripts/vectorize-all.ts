import { env } from "../env";
import { companies } from "../server/db/schema";
import {
	testUniversalSearch,
	universalVectorize,
} from "./universal-vectorizer";
import { getAllVectorizedTables } from "./vectorize-all-tables";

/**
 * 2025年最佳实践：使用通用向量化器处理公司数据
 *
 * 两种方式：
 * 1. 手动指定字段（旧方式）
 * 2. 自动识别所有标记的字段（新方式）
 */

async function vectorizeCompaniesManual() {
	console.log("🚀 开始使用通用向量化器处理公司数据（手动指定字段）");
	console.log("=".repeat(60));

	const collectionName = env.QDRANT_DEFAULT_COLLECTION;

	try {
		// 手动指定向量化字段
		const result = await universalVectorize({
			tableName: "companies",
			tableSchema: companies,
			collectionName: collectionName,
			idField: "companyId",
			textFields: [
				"requiredProducts19978277361", // 客户需求产品
				"remark", // 备注
			],
			batchSize: 100,
		});

		console.log("\n🎉 通用向量化完成！");
		console.log(`✅ 成功处理: ${result.processedRecords} 条记录`);
		console.log(`⏭️  跳过记录: ${result.skippedRecords} 条记录`);
		console.log(`📋 向量化字段: ${result.vectorFields.join(", ")}`);
		console.log(`🔢 总向量数: ${result.totalVectors}`);

		return result;
	} catch (error) {
		console.error("❌ 向量化过程出错:", error);
		throw error;
	}
}

async function vectorizeCompaniesAuto() {
	console.log("🚀 开始使用通用向量化器处理公司数据（自动识别字段）");
	console.log("=".repeat(60));

	const collectionName = env.QDRANT_DEFAULT_COLLECTION;

	try {
		// 自动获取所有向量化字段
		const tableConfigs = await getAllVectorizedTables();
		const companyConfig = tableConfigs.find(
			(cfg) => cfg.tableName === "companies",
		);

		if (!companyConfig) {
			throw new Error("找不到 companies 表的向量化配置");
		}

		console.log(
			`\n📋 自动识别到 ${companyConfig.vectorFields.length} 个向量化字段：`,
		);
		companyConfig.vectorFields.forEach((field) => {
			console.log(`  - ${field.fieldName}: ${field.description}`);
		});

		// 使用自动识别的字段进行向量化
		const result = await universalVectorize({
			tableName: "companies",
			tableSchema: companies,
			collectionName: collectionName,
			idField: "companyId",
			textFields: companyConfig.vectorFields.map((f) => f.fieldName),
			batchSize: 100,
		});

		console.log("\n🎉 通用向量化完成！");
		console.log(`✅ 成功处理: ${result.processedRecords} 条记录`);
		console.log(`⏭️  跳过记录: ${result.skippedRecords} 条记录`);
		console.log(`📋 向量化字段: ${result.vectorFields.join(", ")}`);
		console.log(`🔢 总向量数: ${result.totalVectors}`);

		// 测试搜索功能
		console.log("\n🔎 测试向量搜索功能...");
		await testUniversalSearch(
			collectionName,
			result.vectorFields,
			"文档管理软件",
		);

		return result;
	} catch (error) {
		console.error("❌ 向量化过程出错:", error);
		throw error;
	}
}

// 导出两种方式
export { vectorizeCompaniesManual, vectorizeCompaniesAuto };

// 导入并导出向量化所有表的功能
import { vectorizeAllTables } from "./vectorize-all-tables";
export { vectorizeAllTables };

// 主函数：如果直接运行此脚本，则向量化所有表
if (import.meta.main) {
	console.log("🚀 准备向量化所有标记的表");
	console.log("=".repeat(60));

	vectorizeAllTables()
		.then((stats) => {
			console.log("\n✅ 所有表向量化完成！");
			console.log(`📊 总计处理 ${stats.totalTables} 个表`);
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n❌ 向量化失败:", error);
			process.exit(1);
		});
}
