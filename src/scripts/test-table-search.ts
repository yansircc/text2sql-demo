import { env } from "../env";
import { embedText } from "../lib/embed-text";
import { qdrantService } from "../lib/qdrant/service";
import { getAllVectorizedTables } from "./vectorize-all-tables";

/**
 * 测试每个表的向量搜索功能
 *
 * 使用方法：
 * - 测试所有表：bun run src/scripts/test-table-search.ts
 * - 测试特定查询：bun run src/scripts/test-table-search.ts "你的查询"
 */

async function testTableSearch(query?: string) {
	const testQuery = query || "人工智能";
	const baseCollectionName = env.QDRANT_DEFAULT_COLLECTION;

	console.log("🔎 测试表向量搜索功能");
	console.log("=".repeat(60));
	console.log(`🔍 测试查询: "${testQuery}"`);

	try {
		// 获取所有向量化表
		const tableConfigs = await getAllVectorizedTables();
		console.log(`\n📊 将在 ${tableConfigs.length} 个表中搜索`);

		// 生成查询向量
		console.log("\n🔄 生成查询向量...");
		const searchVector = await embedText(testQuery);
		if (!searchVector) {
			throw new Error("无法生成搜索向量");
		}
		console.log("✅ 查询向量生成成功");

		// 搜索每个表
		for (const config of tableConfigs) {
			const collectionName = `${baseCollectionName}-${config.tableName}`;
			console.log(`\n${"=".repeat(60)}`);
			console.log(`📋 搜索表: ${config.tableName}`);
			console.log(`📦 集合名: ${collectionName}`);

			try {
				// 检查集合是否存在
				const exists = await qdrantService.collectionExists(collectionName);
				if (!exists) {
					console.log("⚠️  集合不存在，跳过");
					continue;
				}

				// 获取集合信息和实际的向量配置
				const collection = await qdrantService.getCollection(collectionName);
				console.log(`📊 向量点数量: ${collection.points_count}`);

				// 获取集合的实际向量字段
				const collectionInfo = await qdrantService
					.getClient()
					.getCollection(collectionName);
				const actualVectorFields = Object.keys(
					collectionInfo.config.params.vectors || {},
				);
				console.log(`🔍 实际向量字段: ${actualVectorFields.join(", ")}`);

				// 只搜索实际存在的向量字段
				const searchableFields = config.vectorFields.filter((field) =>
					actualVectorFields.includes(field.fieldName),
				);

				if (searchableFields.length === 0) {
					console.log("⚠️  该集合没有可搜索的向量字段");
					continue;
				}

				// 搜索每个向量字段
				const allResults: any[] = [];

				for (const field of searchableFields) {
					try {
						const results = await qdrantService.search(collectionName, {
							vectorName: field.fieldName,
							vector: searchVector,
							limit: 3,
							withPayload: true,
							withVectors: false,
						});

						if (results.length > 0) {
							console.log(`\n  🎯 字段 "${field.fieldName}" 的搜索结果:`);
							for (const [index, result] of results.entries()) {
								console.log(
									`    ${index + 1}. ID: ${result.id}, 评分: ${result.score?.toFixed(4)}`,
								);

								// 显示相关内容
								const fieldValue = result.payload?.[field.fieldName] as string;
								if (fieldValue) {
									const preview =
										fieldValue.substring(0, 80) +
										(fieldValue.length > 80 ? "..." : "");
									console.log(`       内容: ${preview}`);
								}
							}
							allResults.push(...results);
						} else {
							console.log(`\n  ⚠️  字段 "${field.fieldName}" 没有找到相关结果`);
						}
					} catch (searchError) {
						console.log(
							`\n  ❌ 搜索字段 "${field.fieldName}" 失败:`,
							searchError,
						);
					}
				}

				// 显示被跳过的字段
				const skippedFields = config.vectorFields.filter(
					(field) => !actualVectorFields.includes(field.fieldName),
				);
				if (skippedFields.length > 0) {
					console.log(
						`\n  ⏭️  跳过的字段（向量化时被忽略）: ${skippedFields.map((f) => f.fieldName).join(", ")}`,
					);
				}

				if (allResults.length === 0) {
					console.log("\n  😔 该表中没有找到任何相关结果");
				} else {
					console.log(`\n  📊 该表共找到 ${allResults.length} 个相关结果`);
				}
			} catch (error) {
				console.error(`\n❌ 搜索表 ${config.tableName} 失败:`, error);
			}
		}

		console.log("\n" + "=".repeat(60));
		console.log("✅ 搜索测试完成！");
	} catch (error) {
		console.error("❌ 搜索测试失败:", error);
		throw error;
	}
}

// 如果直接运行此脚本
if (import.meta.main) {
	const query = process.argv[2];

	testTableSearch(query)
		.then(() => {
			console.log("\n✅ 测试完成");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n❌ 测试失败:", error);
			process.exit(1);
		});
}
