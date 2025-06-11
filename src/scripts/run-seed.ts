#!/usr/bin/env bun
import { seedDatabase } from "./seed";

async function seedAll() {
	console.log("🚀 开始运行完整的数据库种子脚本...\n");

	try {
		// 运行动态种子数据生成
		console.log("📦 运行动态数据生成");
		await seedDatabase();
		console.log("\n✅ 所有数据生成完成！\n");

		console.log("🎉 数据库种子脚本运行完成！");
		console.log("\n📊 完整数据汇总：");
		console.log("- 业务员: 15 个");
		console.log("- 公司: 50 个");
		console.log("- 联系人: ~128 个 (每公司1-4个)");
		console.log("- 客户关系: ~74 个 (包含负责人和协作者)");
		console.log("- 跟进记录: ~151 个 (每公司1-5条)");
		console.log("- 商机: ~33 个 (约60%公司有商机)");
		console.log("- WhatsApp消息: ~287 条 (约40%联系人有消息)");
		console.log("\n💡 提示：现在可以在应用中查看这些丰富的测试数据了！");
		console.log("🔄 每次运行都会生成不同的随机数据，确保测试场景多样化");
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
