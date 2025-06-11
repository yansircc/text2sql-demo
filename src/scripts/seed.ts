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
		"sina.com",
		"sohu.com",
		"126.com",
	];
	return `${name.toLowerCase().replace(/[\s\u4e00-\u9fa5]/g, "")}_${randomInt(100, 999)}@${domains[randomInt(0, domains.length - 1)]}`;
}

// 随机选择数组元素
function randomChoice<T>(array: T[]): T {
	return array[randomInt(0, array.length - 1)]!;
}

// 生成随机日期
function randomDate(start: Date, end: Date): Date {
	return new Date(
		start.getTime() + Math.random() * (end.getTime() - start.getTime()),
	);
}

// 业务员数据模板
const salesUserTemplates = {
	names: [
		"张三",
		"李四",
		"王五",
		"赵六",
		"孙七",
		"周八",
		"吴九",
		"郑十",
		"钱一",
		"陈二",
		"刘三",
		"杨四",
		"黄五",
		"林六",
		"徐七",
		"朱八",
		"马九",
		"胡十",
	],
	departments: [
		"销售一部",
		"销售二部",
		"销售三部",
		"客户成功部",
		"大客户部",
		"渠道销售部",
		"海外销售部",
		"电商销售部",
	],
	avatarSeeds: [
		"zhangsan",
		"lisi",
		"wangwu",
		"zhaoliu",
		"sunqi",
		"zhouba",
		"wujiu",
		"zhengshi",
		"qianyi",
		"chener",
	],
};

// 公司数据模板
const companyTemplates = {
	industries: [
		{
			name: "科技行业",
			businesses: [
				"人工智能软件开发",
				"云计算服务",
				"大数据分析",
				"物联网解决方案",
				"区块链技术",
			],
		},
		{
			name: "贸易行业",
			businesses: [
				"国际贸易",
				"供应链管理",
				"电商平台",
				"跨境贸易",
				"批发零售",
			],
		},
		{
			name: "教育行业",
			businesses: [
				"在线教育",
				"培训服务",
				"教育软件开发",
				"职业培训",
				"企业培训",
			],
		},
		{
			name: "制造业",
			businesses: [
				"电子产品制造",
				"代工服务",
				"精密制造",
				"自动化设备",
				"模具制造",
			],
		},
		{
			name: "新能源",
			businesses: [
				"太阳能设备",
				"储能系统",
				"新能源汽车",
				"风力发电",
				"绿色能源",
			],
		},
		{
			name: "金融服务",
			businesses: ["投资理财", "保险服务", "支付系统", "金融科技", "资产管理"],
		},
		{
			name: "医疗健康",
			businesses: [
				"医疗器械",
				"生物制药",
				"健康管理",
				"医疗信息化",
				"远程医疗",
			],
		},
		{
			name: "房地产",
			businesses: [
				"房地产开发",
				"物业管理",
				"房地产投资",
				"建筑设计",
				"装修装饰",
			],
		},
	],
	cities: [
		{
			city: "深圳",
			province: "广东",
			areas: ["南山区", "福田区", "罗湖区", "宝安区", "龙岗区"],
		},
		{
			city: "上海",
			province: "上海",
			areas: ["浦东新区", "黄浦区", "静安区", "徐汇区", "长宁区"],
		},
		{
			city: "北京",
			province: "北京",
			areas: ["海淀区", "朝阳区", "西城区", "东城区", "丰台区"],
		},
		{
			city: "广州",
			province: "广东",
			areas: ["天河区", "越秀区", "荔湾区", "海珠区", "白云区"],
		},
		{
			city: "成都",
			province: "四川",
			areas: ["高新区", "锦江区", "青羊区", "武侯区", "成华区"],
		},
		{
			city: "杭州",
			province: "浙江",
			areas: ["西湖区", "余杭区", "拱墅区", "江干区", "下城区"],
		},
	],
	companyTypes: [
		"有限公司",
		"股份有限公司",
		"科技有限公司",
		"集团有限公司",
		"技术有限公司",
		"贸易有限公司",
		"实业有限公司",
		"发展有限公司",
		"投资有限公司",
		"咨询有限公司",
	],
	poolNames: ["私海池", "公海池", "重点客户池", "潜在客户池"],
	trailStatuses: [
		"跟进中",
		"待跟进",
		"已成交",
		"暂停跟进",
		"方案制定中",
		"报价阶段",
		"合同谈判",
		"已失单",
	],
	products: [
		"CRM系统",
		"ERP系统",
		"项目管理工具",
		"财务管理系统",
		"人力资源系统",
		"客户服务平台",
		"营销自动化工具",
		"数据分析平台",
		"在线会议工具",
		"文档管理系统",
	],
};

// 联系人数据模板
const contactTemplates = {
	firstNames: [
		"建",
		"伟",
		"敏",
		"静",
		"丽",
		"强",
		"磊",
		"军",
		"洋",
		"勇",
		"艳",
		"杰",
		"娟",
		"涛",
		"明",
		"超",
		"秀",
		"华",
		"文",
		"红",
	],
	lastNames: [
		"王",
		"李",
		"张",
		"刘",
		"陈",
		"杨",
		"赵",
		"黄",
		"周",
		"吴",
		"徐",
		"孙",
		"胡",
		"朱",
		"高",
		"林",
		"何",
		"郭",
		"马",
		"罗",
	],
	positions: [
		"总经理",
		"副总经理",
		"技术总监",
		"销售总监",
		"市场总监",
		"财务总监",
		"人事总监",
		"部门经理",
		"项目经理",
		"产品经理",
		"运营经理",
		"客户经理",
		"区域经理",
		"主管",
		"专员",
		"工程师",
		"分析师",
		"顾问",
		"助理",
		"秘书",
	],
};

// 生成业务员数据
function generateSalesUsers(count: number) {
	const users = [];
	for (let i = 1; i <= count; i++) {
		const name = randomChoice(salesUserTemplates.names);
		users.push({
			userId: `user_${String(i).padStart(3, "0")}`,
			nickname: name,
			name: `${name}${randomChoice(["丰", "雨", "郎", "一", "巧", "峰", "波", "辉", "琳", "芳"])}`,
			avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomChoice(salesUserTemplates.avatarSeeds)}${i}`,
			departmentName: randomChoice(salesUserTemplates.departments),
		});
	}
	return users;
}

// 生成公司数据
function generateCompanies(count: number) {
	const companies = [];
	for (let i = 1001; i <= 1000 + count; i++) {
		const industry = randomChoice(companyTemplates.industries);
		const location = randomChoice(companyTemplates.cities);
		const companyType = randomChoice(companyTemplates.companyTypes);
		const business = randomChoice(industry.businesses);

		const companyNames = [
			`${location.city}市${industry.name.replace("行业", "")}${companyType}`,
			`${location.city}${randomChoice(["新", "华", "盛", "兴", "达", "强", "科", "创", "智", "联"])}${randomChoice(["科技", "发展", "实业", "贸易", "投资"])}${companyType}`,
			`${randomChoice(["中", "华", "国", "大", "金", "银", "天", "地", "东", "西"])}${randomChoice(["创", "新", "兴", "盛", "达", "强", "联", "合", "科", "智"])}${companyType}`,
		];

		const country = randomChoice([
			"CN",
			"US",
			"UK",
			"DE",
			"FR",
			"IT",
			"ES",
			"JP",
			"KR",
			"AU",
		]);
		const countryName =
			{
				CN: "中国",
				US: "美国",
				UK: "英国",
				DE: "德国",
				FR: "法国",
				IT: "意大利",
				ES: "西班牙",
				JP: "日本",
				KR: "韩国",
				AU: "澳大利亚",
			}[country] ?? "其他";

		const companyName = randomChoice(companyNames);
		const shortName = companyName.replace(companyType, "").substring(0, 6);

		companies.push({
			companyId: i,
			name: companyName,
			shortName: shortName,
			country: country,
			countryName: countryName,
			timezone: "Asia/Shanghai",
			poolName: randomChoice(companyTemplates.poolNames),
			groupName: industry.name,
			trailStatus: randomChoice(companyTemplates.trailStatuses),
			star: randomInt(1, 5),
			homepage: `https://www.${shortName.toLowerCase()}.com`,
			address: `${location.city}市${randomChoice(location.areas)}${randomChoice(["科技园", "工业园", "商务区", "创业园", "高新区"])}`,
			remark: randomChoice([
				"高潜力客户，重点关注",
				"传统企业，数字化转型需求",
				"行业领先企业",
				"预算有限，需要性价比方案",
				"决策周期较长",
				"技术要求较高",
				"价格敏感型客户",
				"战略合作伙伴候选",
			]),
			isPrivate: randomChoice([0, 1]),
			hasWebsite20753699812867: randomChoice(["是", "否"]),
			mainBusiness7375678270531: business,
			requiredProducts19978277361:
				randomChoice(companyTemplates.products) +
				"，" +
				randomChoice(companyTemplates.products),
		});
	}
	return companies;
}

// 生成联系人数据
function generateContacts(companyIds: number[]) {
	const contacts = [];
	let contactId = 2001;

	for (const companyId of companyIds) {
		// 每个公司生成1-4个联系人
		const contactCount = randomInt(1, 4);
		let isFirstContact = true;

		for (let j = 0; j < contactCount; j++) {
			const lastName = randomChoice(contactTemplates.lastNames);
			const firstName = randomChoice(contactTemplates.firstNames);
			const name = `${lastName}${randomChoice(contactTemplates.positions)}`;

			contacts.push({
				customerId: contactId++,
				companyId: companyId,
				name: name,
				email: randomEmail(name),
				gender: randomChoice([1, 2]),
				post: randomChoice(contactTemplates.positions),
				whatsapp: randomPhone(),
				tel: randomPhone(),
				isMain: isFirstContact ? 1 : 0,
				remark: randomChoice([
					"技术决策人",
					"最终决策人",
					"负责产品规划",
					"负责日常运营管理",
					"工厂管理负责人",
					"技术专家，项目负责人",
					"财务负责人",
					"采购负责人",
					"信息化负责人",
				]),
			});
			isFirstContact = false;
		}
	}
	return contacts;
}

// 生成公司-业务员关系
function generateCompanyUserRelations(companyIds: number[], userIds: string[]) {
	const relations = [];

	for (const companyId of companyIds) {
		// 每个公司至少有一个负责人
		const owner = randomChoice(userIds);
		relations.push({
			companyId: companyId,
			userId: owner,
			relationType: "owner",
		});

		// 随机添加协作者
		if (Math.random() > 0.5) {
			const collaborator = randomChoice(userIds.filter((id) => id !== owner));
			relations.push({
				companyId: companyId,
				userId: collaborator,
				relationType: "collaborator",
			});
		}
	}
	return relations;
}

// 生成跟进记录
function generateFollowUps(companyIds: number[], userIds: string[]) {
	const followUps = [];
	let followUpId = 3001;

	for (const companyId of companyIds) {
		// 每个公司生成1-5个跟进记录
		const followUpCount = randomInt(1, 5);

		for (let i = 0; i < followUpCount; i++) {
			const pastDate = randomDate(
				new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
				new Date(),
			);

			followUps.push({
				followUpId: followUpId++,
				companyId: companyId,
				userId: randomChoice(userIds),
				content: randomChoice([
					"电话沟通了项目需求，客户对我们的方案很感兴趣",
					"发送了产品资料和报价单，等待客户反馈",
					"安排了下周的现场演示，需要准备demo环境",
					"客户提出了一些技术问题，已转给技术团队处理",
					"与客户讨论了合同条款，价格方面还需要进一步协商",
					"客户决策还在进行中，下周会有最终结果",
					"收到客户的反馈，对我们的服务很满意",
					"跟进项目进度，目前处于评估阶段",
				]),
				type: 101,
				createTime: pastDate,
			});
		}
	}
	return followUps;
}

// 生成商机数据
function generateOpportunities(companyIds: number[], userIds: string[]) {
	const opportunities = [];
	let opportunityId = 4001;

	// 随机选择一些公司生成商机
	const companiesWithOpportunities = companyIds.filter(
		() => Math.random() > 0.4,
	);

	for (const companyId of companiesWithOpportunities) {
		const createdDate = randomDate(
			new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
			new Date(),
		);

		opportunities.push({
			opportunityId: opportunityId++,
			companyId: companyId,
			mainUserId: randomChoice(userIds),
			name: randomChoice([
				"CRM系统采购项目",
				"ERP系统升级项目",
				"数字化转型咨询项目",
				"客户服务平台建设",
				"数据分析平台采购",
				"营销自动化工具",
				"财务管理系统更新",
				"人力资源系统集成",
			]),
			amount: randomInt(50000, 2000000),
			stageName: randomChoice([
				"初步接触",
				"需求分析",
				"方案制定",
				"报价阶段",
				"合同谈判",
				"签约成交",
				"项目实施",
				"已失单",
			]),
			typeName: "软件服务",
			originName: "市场开发",
			remark: "客户有明确的采购需求，正在评估多家供应商的方案",
			createTime: createdDate,
			updateTime: randomDate(createdDate, new Date()),
		});
	}
	return opportunities;
}

// 生成WhatsApp消息
function generateWhatsAppMessages(contactsData: any[], userIds: string[]) {
	const messages = [];
	let messageId = 5001;

	// 随机选择一些联系人生成消息记录
	const contactsWithMessages = contactsData.filter(() => Math.random() > 0.6);

	for (const contact of contactsWithMessages) {
		// 每个联系人生成1-10条消息
		const messageCount = randomInt(1, 10);
		let lastMessageTime = randomDate(
			new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
			new Date(),
		);

		const salesUserPhone = "+8613800138000"; // 业务员统一号码
		const customerPhone = contact.whatsapp || randomPhone();

		for (let i = 0; i < messageCount; i++) {
			const isFromUser = Math.random() > 0.5;

			messages.push({
				messageId: `msg_${String(messageId++).padStart(6, "0")}`,
				timestamp: Math.floor(lastMessageTime.getTime() / 1000),
				fromNumber: isFromUser ? salesUserPhone : customerPhone,
				toNumber: isFromUser ? customerPhone : salesUserPhone,
				body: isFromUser
					? randomChoice([
							"您好，我是XX公司的销售，想了解一下您的业务需求",
							"感谢您对我们产品的关注，我来为您详细介绍",
							"关于您提到的技术问题，我已经安排技术专家来解答",
							"我们的报价已经发送，请您查收",
							"下周可以安排一个现场演示，您看什么时间方便？",
						])
					: randomChoice([
							"好的，我们正在内部评估，稍后给您回复",
							"价格方面还需要再商量一下",
							"技术方案看起来不错，我们需要时间研究",
							"可以安排下周三下午的演示",
							"我们对这个产品很感兴趣，请发送详细资料",
						]),
				fromMe: isFromUser ? 1 : 0,
				contactName: contact.name,
				hasMedia: 0,
				ack: 1,
			});

			// 下一条消息时间
			lastMessageTime = new Date(
				lastMessageTime.getTime() + randomInt(1, 48) * 60 * 60 * 1000,
			);
		}
	}
	return messages;
}

async function seedDatabase() {
	console.log("🌱 开始填充数据库...");

	try {
		// 1. 清空现有数据
		console.log("🧹 清空现有数据...");
		await db.delete(whatsappMessages);
		await db.delete(followUps);
		await db.delete(opportunities);
		await db.delete(companyUserRelations);
		await db.delete(contacts);
		await db.delete(salesUsers);
		await db.delete(companies);

		// 2. 生成并插入业务员数据
		console.log("👥 生成业务员数据...");
		const salesUsersData = generateSalesUsers(15);
		await db.insert(salesUsers).values(salesUsersData);
		console.log(`✅ 插入了 ${salesUsersData.length} 个业务员`);

		// 3. 生成并插入公司数据
		console.log("🏢 生成公司数据...");
		const companiesData = generateCompanies(50);
		await db.insert(companies).values(companiesData);
		console.log(`✅ 插入了 ${companiesData.length} 个公司`);

		// 4. 生成并插入联系人数据
		console.log("👤 生成联系人数据...");
		const companyIds = companiesData.map((c) => c.companyId);
		const contactsData = generateContacts(companyIds);
		await db.insert(contacts).values(contactsData);
		console.log(`✅ 插入了 ${contactsData.length} 个联系人`);

		// 5. 生成并插入客户-业务员关系数据
		console.log("🤝 生成客户-业务员关系数据...");
		const userIds = salesUsersData.map((u) => u.userId);
		const relationData = generateCompanyUserRelations(companyIds, userIds);
		await db.insert(companyUserRelations).values(relationData);
		console.log(`✅ 插入了 ${relationData.length} 个客户-业务员关系`);

		// 6. 生成并插入跟进记录
		console.log("📝 生成跟进记录数据...");
		const followUpsData = generateFollowUps(companyIds, userIds);
		await db.insert(followUps).values(followUpsData);
		console.log(`✅ 插入了 ${followUpsData.length} 个跟进记录`);

		// 7. 生成并插入商机数据
		console.log("💰 生成商机数据...");
		const opportunitiesData = generateOpportunities(companyIds, userIds);
		await db.insert(opportunities).values(opportunitiesData);
		console.log(`✅ 插入了 ${opportunitiesData.length} 个商机`);

		// 8. 生成并插入WhatsApp消息数据
		console.log("💬 生成WhatsApp消息数据...");
		const messagesData = generateWhatsAppMessages(contactsData, userIds);
		await db.insert(whatsappMessages).values(messagesData);
		console.log(`✅ 插入了 ${messagesData.length} 条WhatsApp消息`);

		console.log("✅ 数据库种子数据插入完成！");
		console.log("\n📊 数据汇总：");
		console.log(`- 业务员: ${salesUsersData.length} 个`);
		console.log(`- 公司: ${companiesData.length} 个`);
		console.log(`- 联系人: ${contactsData.length} 个`);
		console.log(`- 客户关系: ${relationData.length} 个`);
		console.log(`- 跟进记录: ${followUpsData.length} 个`);
		console.log(`- 商机: ${opportunitiesData.length} 个`);
		console.log(`- WhatsApp消息: ${messagesData.length} 条`);
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
