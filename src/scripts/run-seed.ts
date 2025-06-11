#!/usr/bin/env bun
import { seedDatabase } from "./seed";

console.log("开始运行数据库种子脚本...\n");

seedDatabase()
	.then(() => {
		console.log("\n🎉 数据库种子脚本运行完成！");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n❌ 数据库种子脚本运行失败:", error);
		process.exit(1);
	});
