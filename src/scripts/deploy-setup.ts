#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { env } from "@/env";

async function deploySetup() {
	console.log("🚀 开始部署时数据库初始化...\n");

	try {
		// 检查环境变量
		if (!env.DATABASE_URL) {
			throw new Error("❌ DATABASE_URL 环境变量未设置");
		}

		console.log("📋 数据库URL:", env.DATABASE_URL.replace(/\/\/.*@/, "//***@")); // 隐藏密码部分

		// 执行数据库 push
		console.log("📦 执行数据库 schema 推送...");
		execSync("bun db:push", { stdio: "inherit" });
		console.log("✅ 数据库 schema 推送完成\n");

		// 执行数据库 seed
		console.log("🌱 执行数据库数据种子...");
		execSync("bun db:seed", { stdio: "inherit" });
		console.log("✅ 数据库数据种子完成\n");

		console.log("🎉 部署时数据库初始化完成！");
	} catch (error) {
		console.error("❌ 部署初始化失败:", error);
		console.error("\n💡 提示:");
		console.error("- 确保 DATABASE_URL 环境变量已正确设置");
		console.error("- 确保数据库服务器可访问");
		console.error("- 检查网络连接");
		throw error;
	}
}

// 如果直接运行此脚本
if (require.main === module) {
	deploySetup().catch((error) => {
		console.error("Deploy setup failed:", error);
		process.exit(1);
	});
}

export { deploySetup };
