#!/usr/bin/env bun
import { seedDatabase } from "./seed";
import { seedExtendedData } from "./seed-extended";

async function seedAll() {
	console.log("🚀 开始运行完整的数据库种子脚本...\n");

	try {
		// 1. 运行基础种子数据
		console.log("📦 第一阶段：插入基础数据");
		await seedDatabase();
		console.log("\n✅ 基础数据插入完成！\n");

		// 2. 运行扩展种子数据
		console.log("📦 第二阶段：插入扩展数据");
		await seedExtendedData();
		console.log("\n✅ 扩展数据插入完成！\n");

		console.log("🎉 所有数据库种子脚本运行完成！");
		console.log("\n📊 完整数据汇总：");
		console.log("- 业务员: 5 个");
		console.log("- 公司: 5 个");
		console.log("- 联系人: 9 个");
		console.log("- 客户关系: 8 个");
		console.log("- 跟进动态: 5 条");
		console.log("- 商机: 4 个");
		console.log("- WhatsApp消息: 6 条");
		console.log("\n💡 提示：现在可以在应用中查看这些测试数据了！");
	} catch (error) {
		console.error("❌ 种子脚本运行失败:", error);
		throw error;
	}
}

// 如果直接运行此脚本
if (require.main === module) {
	seedAll().catch((error) => {
		console.error("Complete seed failed:", error);
		process.exit(1);
	});
}

export { seedAll };
