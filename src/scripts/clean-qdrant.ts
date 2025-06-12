import { env } from "../env";
import { qdrantService } from "../lib/qdrant/service";

/**
 * 清理 Qdrant 集合
 *
 * 使用方法：
 * - 清理默认集合：bun run src/scripts/clean-qdrant.ts
 * - 清理指定集合：bun run src/scripts/clean-qdrant.ts collection-name
 */

async function cleanQdrantCollection(collectionName?: string) {
	const targetCollection = collectionName || env.QDRANT_DEFAULT_COLLECTION;

	console.log("🧹 开始清理 Qdrant 集合");
	console.log("=".repeat(60));
	console.log(`📦 目标集合: ${targetCollection}`);

	try {
		// 检查集合是否存在
		const exists = await qdrantService.collectionExists(targetCollection);

		if (!exists) {
			console.log("⚠️  集合不存在，无需清理");
			return;
		}

		// 获取集合信息
		const collection = await qdrantService.getCollection(targetCollection);
		console.log("\n📊 集合信息：");
		console.log(`  - 向量点数量: ${collection.points_count}`);
		console.log(`  - 索引状态: ${collection.status}`);

		// 确认删除
		console.log("\n⚠️  即将删除集合，此操作不可恢复！");
		console.log("   如果要继续，请在5秒内按 Ctrl+C 取消...");

		// 等待5秒
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// 删除集合
		console.log("\n🗑️  正在删除集合...");
		await qdrantService.deleteCollection(targetCollection);

		console.log("✅ 集合删除成功！");

		// 验证删除
		const stillExists = await qdrantService.collectionExists(targetCollection);
		if (stillExists) {
			console.error("❌ 集合删除失败，仍然存在");
		} else {
			console.log("✅ 验证完成，集合已被完全删除");
		}
	} catch (error) {
		console.error("❌ 清理过程出错:", error);
		throw error;
	}
}

// 如果直接运行此脚本
if (import.meta.main) {
	const collectionName = process.argv[2];

	cleanQdrantCollection(collectionName)
		.then(() => {
			console.log("\n✅ 清理完成");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n❌ 清理失败:", error);
			process.exit(1);
		});
}
