import { env } from "../env";
import { companies } from "../server/db/schema";
import {
	testUniversalSearch,
	universalVectorize,
} from "./universal-vectorizer";

/**
 * 2025年最佳实践：使用通用向量化器处理公司数据
 * 保持原始字段名，不进行映射
 */

async function vectorizeCompaniesOptimized() {
	console.log("🚀 开始使用通用向量化器处理公司数据");
	console.log("=".repeat(60));

	const collectionName = env.QDRANT_DEFAULT_COLLECTION;

	try {
		// 使用通用向量化器
		const result = await universalVectorize({
			tableName: "companies",
			tableSchema: companies,
			collectionName: collectionName,
			idField: "companyId",
			textFields: [
				"requiredProducts19978277361", // 客户需求产品 - 保持原始字段名
				"remark", // 备注 - 保持原始字段名
			],
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

export { vectorizeCompaniesOptimized };
