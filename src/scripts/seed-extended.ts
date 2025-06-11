import { followUps, opportunities, whatsappMessages } from "@/server/db/schema";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

// 创建数据库连接
const client = createClient({
	url: process.env.DATABASE_URL || "file:./db.sqlite",
});
const db = drizzle(client);

// 生成随机整数
function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedExtendedData() {
	console.log("🌱 开始填充扩展数据...");

	try {
		// 1. 插入跟进动态数据
		console.log("📋 插入跟进动态数据...");
		const followUpsData = [
			{
				followUpId: 3001,
				companyId: 1001,
				customerId: 2001,
				userId: "user_001",
				content:
					"与客户技术总监进行了初步沟通，了解了他们对CRM系统的需求。客户对AI功能特别感兴趣，计划下周安排产品演示。",
				type: 101,
			},
			{
				followUpId: 3002,
				companyId: 1001,
				customerId: 2002,
				userId: "user_001",
				content:
					"产品经理提出了具体的功能需求清单，主要关注项目管理和团队协作功能。已安排技术团队准备详细方案。",
				type: 102,
			},
			{
				followUpId: 3003,
				companyId: 1002,
				customerId: 2003,
				userId: "user_002",
				content:
					"董事长表示公司正在进行数字化转型，对ERP系统有迫切需求。预算充足，决策周期较短。",
				type: 101,
			},
			{
				followUpId: 3004,
				companyId: 1003,
				customerId: 2005,
				userId: "user_003",
				content:
					"教育科技公司CEO对我们的学员管理系统很满意，已经签署了合作意向书，进入合同谈判阶段。",
				type: 103,
			},
			{
				followUpId: 3005,
				companyId: 1005,
				customerId: 2008,
				userId: "user_001",
				content:
					"新能源公司总经理提到他们需要一套完整的项目管理解决方案，包括客户服务平台。已安排下周实地考察。",
				type: 101,
			},
		];

		await db.insert(followUps).values(followUpsData);
		console.log(`✅ 插入了 ${followUpsData.length} 条跟进动态`);

		// 2. 插入商机数据
		console.log("💰 插入商机数据...");
		const opportunitiesData = [
			{
				opportunityId: 4001,
				name: "深圳科技创新-AI驱动CRM系统项目",
				serialId: "OPP-2024-001",
				companyId: 1001,
				mainUserId: "user_001",
				amount: 580000,
				currency: "CNY",
				stageName: "需求确认",
				typeName: "新客户",
				originName: "官网咨询",
				remark: "高价值项目，客户对AI功能需求强烈",
			},
			{
				opportunityId: 4002,
				name: "上海贸易发展-数字化转型解决方案",
				serialId: "OPP-2024-002",
				companyId: 1002,
				mainUserId: "user_002",
				amount: 350000,
				currency: "CNY",
				stageName: "方案制定",
				typeName: "升级客户",
				originName: "电话营销",
				remark: "传统贸易企业转型，预算有保障",
			},
			{
				opportunityId: 4003,
				name: "北京教育科技-学员管理平台",
				serialId: "OPP-2024-003",
				companyId: 1003,
				mainUserId: "user_003",
				amount: 420000,
				currency: "CNY",
				stageName: "已成交",
				typeName: "新客户",
				originName: "合作伙伴推荐",
				remark: "教育行业标杆客户，有复购潜力",
			},
			{
				opportunityId: 4004,
				name: "成都新能源-项目管理系统",
				serialId: "OPP-2024-004",
				companyId: 1005,
				mainUserId: "user_001",
				amount: 680000,
				currency: "CNY",
				stageName: "商务谈判",
				typeName: "新客户",
				originName: "行业展会",
				remark: "新能源行业增长迅速，长期合作机会大",
			},
		];

		await db.insert(opportunities).values(opportunitiesData);
		console.log(`✅ 插入了 ${opportunitiesData.length} 个商机`);

		// 3. 插入WhatsApp消息数据
		console.log("💬 插入WhatsApp消息数据...");
		const whatsappData = [
			{
				messageId: "msg_001_1",
				timestamp: Math.floor(Date.now() / 1000) - 3600,
				fromNumber: "+8613912345678",
				toNumber: "+8613987654321",
				body: "您好，我是深圳科技创新的刘总监，想了解一下贵公司的CRM系统解决方案。",
				fromMe: 0,
				contactName: "刘总监",
				hasMedia: 0,
				ack: 2,
			},
			{
				messageId: "msg_001_2",
				timestamp: Math.floor(Date.now() / 1000) - 3500,
				fromNumber: "+8613987654321",
				toNumber: "+8613912345678",
				body: "您好刘总监！很高兴为您介绍我们的AI驱动CRM解决方案。我们的系统特别适合科技创新企业，能够大幅提升客户管理效率。",
				fromMe: 1,
				contactName: "刘总监",
				hasMedia: 0,
				ack: 2,
			},
			{
				messageId: "msg_002_1",
				timestamp: Math.floor(Date.now() / 1000) - 7200,
				fromNumber: "+8613123456789",
				toNumber: "+8613987654321",
				body: "请问贵公司的ERP系统能否与我们现有的财务系统对接？",
				fromMe: 0,
				contactName: "王董事长",
				hasMedia: 0,
				ack: 2,
			},
			{
				messageId: "msg_002_2",
				timestamp: Math.floor(Date.now() / 1000) - 7100,
				fromNumber: "+8613987654321",
				toNumber: "+8613123456789",
				body: "王董您好！我们的ERP系统提供丰富的API接口，支持与主流财务系统无缝对接。我安排技术专家为您详细介绍。",
				fromMe: 1,
				contactName: "王董事长",
				hasMedia: 0,
				ack: 2,
			},
			{
				messageId: "msg_003_1",
				timestamp: Math.floor(Date.now() / 1000) - 1800,
				fromNumber: "+8613345678901",
				toNumber: "+8613987654321",
				body: "感谢贵公司提供的学员管理解决方案，我们的团队对演示效果很满意！",
				fromMe: 0,
				contactName: "张校长",
				hasMedia: 0,
				ack: 2,
			},
			{
				messageId: "msg_003_2",
				timestamp: Math.floor(Date.now() / 1000) - 1700,
				fromNumber: "+8613987654321",
				toNumber: "+8613345678901",
				body: "张校长您好！非常高兴得到您的认可。我们将尽快准备合同草案，期待与贵公司的深度合作。",
				fromMe: 1,
				contactName: "张校长",
				hasMedia: 0,
				ack: 2,
			},
		];

		await db.insert(whatsappMessages).values(whatsappData);
		console.log(`✅ 插入了 ${whatsappData.length} 条WhatsApp消息`);

		console.log("✅ 扩展数据插入完成！");
		console.log("\n📊 扩展数据汇总：");
		console.log(`- 跟进动态: ${followUpsData.length} 条`);
		console.log(`- 商机: ${opportunitiesData.length} 个`);
		console.log(`- WhatsApp消息: ${whatsappData.length} 条`);
	} catch (error) {
		console.error("❌ 插入扩展数据时发生错误:", error);
		throw error;
	} finally {
		await client.close();
	}
}

// 如果直接运行此脚本
if (require.main === module) {
	seedExtendedData().catch((error) => {
		console.error("Extended seed failed:", error);
		process.exit(1);
	});
}

export { seedExtendedData };
