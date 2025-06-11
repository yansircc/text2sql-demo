import {
	companies,
	companyUserRelations,
	contacts,
	followUps,
	opportunities,
	salesUsers,
	whatsappMessages,
} from "@/server/db/schema";
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

// 生成随机手机号
function randomPhone(): string {
	return `+86${randomInt(130, 199)}${randomInt(1000, 9999)}${randomInt(1000, 9999)}`;
}

// 生成随机邮箱
function randomEmail(name: string): string {
	const domains = [
		"gmail.com",
		"qq.com",
		"163.com",
		"hotmail.com",
		"outlook.com",
	];
	return `${name.toLowerCase().replace(/\s+/g, "")}@${domains[randomInt(0, domains.length - 1)]}`;
}

async function seedDatabase() {
	console.log("🌱 开始填充数据库...");

	try {
		// 1. 清空现有数据（可选）
		console.log("🧹 清空现有数据...");
		await db.delete(whatsappMessages);
		await db.delete(followUps);
		await db.delete(opportunities);
		await db.delete(companyUserRelations);
		await db.delete(contacts);
		await db.delete(salesUsers);
		await db.delete(companies);

		// 2. 插入业务员数据
		console.log("👥 插入业务员数据...");
		const salesUsersData = [
			{
				userId: "user_001",
				nickname: "张三",
				name: "张三丰",
				avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan",
				departmentName: "销售一部",
			},
			{
				userId: "user_002",
				nickname: "李四",
				name: "李思雨",
				avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lisi",
				departmentName: "销售一部",
			},
			{
				userId: "user_003",
				nickname: "王五",
				name: "王五郎",
				avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=wangwu",
				departmentName: "销售二部",
			},
			{
				userId: "user_004",
				nickname: "赵六",
				name: "赵六一",
				avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoliu",
				departmentName: "销售二部",
			},
			{
				userId: "user_005",
				nickname: "孙七",
				name: "孙七巧",
				avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sunqi",
				departmentName: "客户成功部",
			},
		];

		await db.insert(salesUsers).values(salesUsersData);
		console.log(`✅ 插入了 ${salesUsersData.length} 个业务员`);

		// 3. 插入公司数据
		console.log("🏢 插入公司数据...");
		const companiesData = [
			{
				companyId: 1001,
				name: "深圳市科技创新有限公司",
				shortName: "科技创新",
				country: "CN",
				countryName: "中国",
				timezone: "Asia/Shanghai",
				poolName: "私海池",
				groupName: "科技行业",
				trailStatus: "跟进中",
				star: 5,
				homepage: "https://www.techinnov.com",
				address: "深圳市南山区科技园",
				remark: "高潜力客户，重点关注",
				isPrivate: 1,
				hasWebsite20753699812867: "是",
				mainBusiness7375678270531: "人工智能软件开发",
				requiredProducts19978277361: "CRM系统，项目管理工具",
			},
			{
				companyId: 1002,
				name: "上海贸易发展集团",
				shortName: "贸易发展",
				country: "CN",
				countryName: "中国",
				timezone: "Asia/Shanghai",
				poolName: "公海池",
				groupName: "贸易行业",
				trailStatus: "待跟进",
				star: 3,
				homepage: "https://www.tradedev.com",
				address: "上海市浦东新区陆家嘴",
				remark: "传统贸易公司，数字化转型需求",
				isPrivate: 0,
				hasWebsite20753699812867: "是",
				mainBusiness7375678270531: "国际贸易，供应链管理",
				requiredProducts19978277361: "ERP系统，财务管理系统",
			},
			{
				companyId: 1003,
				name: "北京教育科技股份有限公司",
				shortName: "教育科技",
				country: "CN",
				countryName: "中国",
				timezone: "Asia/Shanghai",
				poolName: "私海池",
				groupName: "教育行业",
				trailStatus: "已成交",
				star: 4,
				homepage: "https://www.edutech.com",
				address: "北京市海淀区中关村",
				remark: "在线教育平台，发展迅速",
				isPrivate: 1,
				hasWebsite20753699812867: "是",
				mainBusiness7375678270531: "在线教育，培训服务",
				requiredProducts19978277361: "学员管理系统，在线会议工具",
			},
			{
				companyId: 1004,
				name: "广州制造业有限公司",
				shortName: "广州制造",
				country: "CN",
				countryName: "中国",
				timezone: "Asia/Shanghai",
				poolName: "公海池",
				groupName: "制造业",
				trailStatus: "暂停跟进",
				star: 2,
				homepage: "https://www.gzmfg.com",
				address: "广州市天河区工业园",
				remark: "传统制造业，预算有限",
				isPrivate: 0,
				hasWebsite20753699812867: "否",
				mainBusiness7375678270531: "电子产品制造，代工服务",
				requiredProducts19978277361: "生产管理系统",
			},
			{
				companyId: 1005,
				name: "成都新能源技术公司",
				shortName: "成都新能源",
				country: "CN",
				countryName: "中国",
				timezone: "Asia/Shanghai",
				poolName: "私海池",
				groupName: "新能源",
				trailStatus: "方案制定中",
				star: 4,
				homepage: "https://www.cdnewenergy.com",
				address: "成都市高新区科技大道",
				remark: "新能源行业领先企业",
				isPrivate: 1,
				hasWebsite20753699812867: "是",
				mainBusiness7375678270531: "太阳能设备，储能系统",
				requiredProducts19978277361: "项目管理系统，客户服务平台",
			},
		];

		await db.insert(companies).values(companiesData);
		console.log(`✅ 插入了 ${companiesData.length} 个公司`);

		// 4. 插入联系人数据
		console.log("👤 插入联系人数据...");
		const contactsData = [
			// 科技创新公司的联系人
			{
				customerId: 2001,
				companyId: 1001,
				name: "刘总监",
				email: randomEmail("刘总监"),
				gender: 1,
				post: "技术总监",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 1,
				remark: "技术决策人，对AI很感兴趣",
			},
			{
				customerId: 2002,
				companyId: 1001,
				name: "陈经理",
				email: randomEmail("陈经理"),
				gender: 2,
				post: "产品经理",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 0,
				remark: "负责产品规划",
			},
			// 贸易发展集团的联系人
			{
				customerId: 2003,
				companyId: 1002,
				name: "王董事长",
				email: randomEmail("王董事长"),
				gender: 1,
				post: "董事长",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 1,
				remark: "最终决策人",
			},
			{
				customerId: 2004,
				companyId: 1002,
				name: "李部长",
				email: randomEmail("李部长"),
				gender: 2,
				post: "信息化部长",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 0,
				remark: "负责数字化转型项目",
			},
			// 教育科技的联系人
			{
				customerId: 2005,
				companyId: 1003,
				name: "张校长",
				email: randomEmail("张校长"),
				gender: 1,
				post: "CEO",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 1,
				remark: "教育行业资深人士",
			},
			{
				customerId: 2006,
				companyId: 1003,
				name: "赵主任",
				email: randomEmail("赵主任"),
				gender: 2,
				post: "运营主任",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 0,
				remark: "负责日常运营管理",
			},
			// 广州制造业联系人
			{
				customerId: 2007,
				companyId: 1004,
				name: "周厂长",
				email: randomEmail("周厂长"),
				gender: 1,
				post: "厂长",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 1,
				remark: "工厂管理负责人",
			},
			// 成都新能源联系人
			{
				customerId: 2008,
				companyId: 1005,
				name: "吴总",
				email: randomEmail("吴总"),
				gender: 2,
				post: "总经理",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 1,
				remark: "公司创始人，技术背景",
			},
			{
				customerId: 2009,
				companyId: 1005,
				name: "郑工程师",
				email: randomEmail("郑工程师"),
				gender: 1,
				post: "首席工程师",
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: 0,
				remark: "技术专家，项目负责人",
			},
		];

		await db.insert(contacts).values(contactsData);
		console.log(`✅ 插入了 ${contactsData.length} 个联系人`);

		// 5. 插入客户-业务员关系数据
		console.log("🤝 插入客户-业务员关系数据...");
		const relationData = [
			{ companyId: 1001, userId: "user_001", relationType: "owner" },
			{ companyId: 1001, userId: "user_002", relationType: "collaborator" },
			{ companyId: 1002, userId: "user_002", relationType: "owner" },
			{ companyId: 1003, userId: "user_003", relationType: "owner" },
			{ companyId: 1003, userId: "user_005", relationType: "collaborator" },
			{ companyId: 1004, userId: "user_004", relationType: "owner" },
			{ companyId: 1005, userId: "user_001", relationType: "owner" },
			{ companyId: 1005, userId: "user_003", relationType: "collaborator" },
		];

		await db.insert(companyUserRelations).values(relationData);
		console.log(`✅ 插入了 ${relationData.length} 个客户-业务员关系`);

		console.log("✅ 数据库种子数据插入完成！");
		console.log("\n📊 数据汇总：");
		console.log(`- 业务员: ${salesUsersData.length} 个`);
		console.log(`- 公司: ${companiesData.length} 个`);
		console.log(`- 联系人: ${contactsData.length} 个`);
		console.log(`- 客户关系: ${relationData.length} 个`);
	} catch (error) {
		console.error("❌ 插入数据时发生错误:", error);
		throw error;
	} finally {
		await client.close();
	}
}

// 如果直接运行此脚本
if (require.main === module) {
	seedDatabase().catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	});
}

export { seedDatabase };
