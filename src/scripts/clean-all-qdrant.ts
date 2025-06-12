import { env } from "../env";
import { qdrantService } from "../lib/qdrant/service";
import { getAllVectorizedTables } from "./vectorize-all-tables";

/**
 * 清理所有表的 Qdrant 集合
 *
 * 使用方法：bun run src/scripts/clean-all-qdrant.ts
 */

async function cleanAllQdrantCollections() {
	const baseCollectionName = env.QDRANT_DEFAULT_COLLECTION;

	console.log("🧹 开始清理所有表的 Qdrant 集合");
	console.log("=".repeat(60));
	console.log(`📦 基础集合名: ${baseCollectionName}`);

	try {
		// 获取所有向量化表
		const tableConfigs = await getAllVectorizedTables();
		console.log(`\n📊 发现 ${tableConfigs.length} 个需要清理的表集合`);

		// 获取所有集合名
		const collectionNames = tableConfigs.map(
			(config) => `${baseCollectionName}-${config.tableName}`,
		);

		console.log("\n将要清理以下集合：");
		for (const name of collectionNames) {
			console.log(`  - ${name}`);
		}

		// 确认删除
		console.log("\n⚠️  即将删除所有集合，此操作不可恢复！");
		console.log("   如果要继续，请在5秒内按 Ctrl+C 取消...");

		// 等待5秒
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// 统计信息
		let deletedCount = 0;
		let notFoundCount = 0;
		let errorCount = 0;

		// 逐个删除集合
		for (const collectionName of collectionNames) {
			try {
				console.log(`\n🗑️  正在删除集合: ${collectionName}...`);

				// 检查集合是否存在
				const exists = await qdrantService.collectionExists(collectionName);

				if (!exists) {
					console.log("   ⚠️  集合不存在");
					notFoundCount++;
					continue;
				}

				// 获取集合信息
				const collection = await qdrantService.getCollection(collectionName);
				console.log(`   📊 向量点数量: ${collection.points_count}`);

				// 删除集合
				await qdrantService.deleteCollection(collectionName);
				console.log("   ✅ 删除成功");
				deletedCount++;
			} catch (error) {
				console.error(`   ❌ 删除失败: ${error}`);
				errorCount++;
			}
		}

		// 打印总结
		console.log("\n" + "=".repeat(60));
		console.log("🎉 清理完成！");
		console.log("📊 统计：");
		console.log(`  - 成功删除: ${deletedCount} 个集合`);
		console.log(`  - 不存在: ${notFoundCount} 个集合`);
		console.log(`  - 删除失败: ${errorCount} 个集合`);
		console.log(`  - 总计: ${collectionNames.length} 个集合`);
	} catch (error) {
		console.error("❌ 清理过程出错:", error);
		throw error;
	}
}

// 如果直接运行此脚本
if (import.meta.main) {
	cleanAllQdrantCollections()
		.then(() => {
			console.log("\n✅ 所有集合清理完成");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n❌ 清理失败:", error);
			process.exit(1);
		});
}
