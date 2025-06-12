import { getAllVectorizedTables } from "./vectorize-all-tables";

/**
 * 测试脚本：展示自动向量化功能
 *
 * 这个脚本会：
 * 1. 分析数据库schema
 * 2. 显示所有向量化字段
 * 3. 不执行实际的向量化操作
 */

async function testVectorizeAll() {
	console.log("🧪 测试自动向量化字段识别功能");
	console.log("=".repeat(60));

	try {
		// 获取所有需要向量化的表配置
		const tableConfigs = await getAllVectorizedTables();

		console.log(`\n📊 发现 ${tableConfigs.length} 个包含向量化字段的表`);
		console.log("\n详细信息：");

		// 按表显示详细信息
		for (const [index, config] of tableConfigs.entries()) {
			console.log(`\n${index + 1}. 表名: ${config.tableName}`);
			console.log(`   字段数: ${config.vectorFields.length}`);
			console.log("   向量化字段：");

			for (const field of config.vectorFields) {
				console.log(`     - ${field.fieldName}`);
				console.log(`       描述: ${field.description}`);
			}
		}

		// 统计信息
		const totalFields = tableConfigs.reduce(
			(sum, cfg) => sum + cfg.vectorFields.length,
			0,
		);
		console.log("\n" + "=".repeat(60));
		console.log("📈 统计汇总：");
		console.log(`   - 总表数: ${tableConfigs.length}`);
		console.log(`   - 总字段数: ${totalFields}`);
		console.log(
			`   - 平均每表字段数: ${(totalFields / tableConfigs.length).toFixed(2)}`,
		);

		// 生成字段映射表
		console.log("\n📋 向量化字段映射表：");
		console.log("-".repeat(60));
		console.log("| 表名 | 字段名 | 描述 |");
		console.log("|------|--------|------|");

		for (const config of tableConfigs) {
			for (const field of config.vectorFields) {
				console.log(
					`| ${config.tableName} | ${field.fieldName} | ${field.description.substring(0, 40)}... |`,
				);
			}
		}

		console.log(
			"\n💡 提示：运行 'bun run src/scripts/vectorize-all-tables.ts' 来执行实际的向量化操作",
		);

		return tableConfigs;
	} catch (error) {
		console.error("❌ 测试失败:", error);
		throw error;
	}
}

// 如果直接运行此脚本
if (import.meta.main) {
	testVectorizeAll()
		.then(() => {
			console.log("\n✅ 测试完成");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n❌ 测试失败:", error);
			process.exit(1);
		});
}
