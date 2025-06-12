import { env } from "../env";
import { qdrantService } from "../lib/qdrant/service";
import { getAllVectorizedTables } from "./vectorize-all-tables";

/**
 * 检查向量字段状态
 * 显示哪些字段被标记但未实际向量化
 *
 * 使用方法：bun run src/scripts/check-vector-fields.ts
 */

async function checkVectorFields() {
	const baseCollectionName = env.QDRANT_DEFAULT_COLLECTION;

	console.log("🔍 检查向量字段状态");
	console.log("=".repeat(60));

	try {
		// 获取所有向量化表
		const tableConfigs = await getAllVectorizedTables();

		// 统计信息
		let totalPlannedFields = 0;
		let totalActualFields = 0;
		let totalSkippedFields = 0;

		for (const config of tableConfigs) {
			const collectionName = `${baseCollectionName}-${config.tableName}`;
			console.log(`\n📋 表: ${config.tableName}`);
			console.log(`📦 集合: ${collectionName}`);

			// 标记的字段
			const plannedFields = config.vectorFields.map((f) => f.fieldName);
			console.log(
				`📝 标记的字段 (${plannedFields.length}): ${plannedFields.join(", ")}`,
			);
			totalPlannedFields += plannedFields.length;

			try {
				// 检查集合是否存在
				const exists = await qdrantService.collectionExists(collectionName);
				if (!exists) {
					console.log("⚠️  集合不存在");
					totalSkippedFields += plannedFields.length;
					continue;
				}

				// 获取实际的向量字段
				const collectionInfo = await qdrantService
					.getClient()
					.getCollection(collectionName);
				const actualFields = Object.keys(
					collectionInfo.config.params.vectors || {},
				);
				console.log(
					`✅ 实际的字段 (${actualFields.length}): ${actualFields.join(", ")}`,
				);
				totalActualFields += actualFields.length;

				// 被跳过的字段
				const skippedFields = plannedFields.filter(
					(field) => !actualFields.includes(field),
				);
				if (skippedFields.length > 0) {
					console.log(
						`⏭️  被跳过的字段 (${skippedFields.length}): ${skippedFields.join(", ")}`,
					);
					totalSkippedFields += skippedFields.length;

					// 显示被跳过的原因（通常是数据为空）
					for (const field of skippedFields) {
						const fieldInfo = config.vectorFields.find(
							(f) => f.fieldName === field,
						);
						if (fieldInfo) {
							console.log(`   - ${field}: 可能原因是数据为空或非文本类型`);
						}
					}
				} else {
					console.log("✅ 所有标记的字段都已向量化");
				}
			} catch (error) {
				console.error("❌ 检查失败:", error);
			}
		}

		// 打印总结
		console.log("\n" + "=".repeat(60));
		console.log("📊 总体统计：");
		console.log(`  - 标记的字段总数: ${totalPlannedFields}`);
		console.log(`  - 实际向量化的字段: ${totalActualFields}`);
		console.log(`  - 被跳过的字段: ${totalSkippedFields}`);
		console.log(
			`  - 向量化成功率: ${((totalActualFields / totalPlannedFields) * 100).toFixed(1)}%`,
		);
	} catch (error) {
		console.error("❌ 检查过程出错:", error);
		throw error;
	}
}

// 如果直接运行此脚本
if (import.meta.main) {
	checkVectorFields()
		.then(() => {
			console.log("\n✅ 检查完成");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n❌ 检查失败:", error);
			process.exit(1);
		});
}
