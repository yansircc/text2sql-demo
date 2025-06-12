import type { QueryTask } from "../constants";

/**
 * 混合搜索查询
 * 这些查询既需要SQL精确条件（如时间、数量、状态等），又需要语义理解
 * 结合了精确过滤和语义匹配的优势
 */
export const hybrid: QueryTask[] = [
	{
		id: "hybrid-1",
		text: "找出私海中需要AI解决方案的大型企业",
		difficulty: 2,
		category: "混合搜索",
		description: "SQL条件：isPrivate=1，大型企业；语义：AI解决方案",
		tables: ["companies"],
	},
	{
		id: "hybrid-2",
		text: "最近3个月有跟进记录且对云服务感兴趣的客户",
		difficulty: 3,
		category: "混合搜索",
		description: "SQL条件：followUps时间范围；语义：云服务需求",
		tables: ["companies", "followUps"],
	},
	{
		id: "hybrid-3",
		text: "美国地区需要企业管理软件的5星级客户",
		difficulty: 2,
		category: "混合搜索",
		description: "SQL条件：country='US', star=5；语义：企业管理软件",
		tables: ["companies"],
	},
	{
		id: "hybrid-4",
		text: "有商机金额超过10万美元且需要数字化转型的公司",
		difficulty: 3,
		category: "混合搜索",
		description: "SQL条件：opportunities.amount>100000；语义：数字化转型",
		tables: ["companies", "opportunities"],
	},
	{
		id: "hybrid-5",
		text: "2024年转为私海且对物联网技术有需求的客户",
		difficulty: 2,
		category: "混合搜索",
		description: "SQL条件：privateTime在2024年；语义：物联网需求",
		tables: ["companies"],
	},
	{
		id: "hybrid-6",
		text: "有女性联系人且需要远程协作工具的公司",
		difficulty: 3,
		category: "混合搜索",
		description: "SQL条件：contacts.gender=2；语义：远程协作工具",
		tables: ["companies", "contacts"],
	},
	{
		id: "hybrid-7",
		text: "张三负责的需要网络安全服务的客户",
		difficulty: 3,
		category: "混合搜索",
		description: "SQL条件：业务员姓名匹配；语义：网络安全服务",
		tables: ["companies", "companyUserRelations", "salesUsers"],
	},
	{
		id: "hybrid-8",
		text: "有WhatsApp沟通记录且对自动化办公感兴趣的企业",
		difficulty: 3,
		category: "混合搜索",
		description: "SQL条件：存在WhatsApp消息；语义：自动化办公",
		tables: ["companies", "contacts", "whatsappMessages"],
	},
	{
		id: "hybrid-9",
		text: "商机阶段为'谈判中'且需要数据分析平台的客户",
		difficulty: 3,
		category: "混合搜索",
		description:
			"SQL条件：opportunities.stageName='谈判中'；语义：数据分析平台",
		tables: ["companies", "opportunities"],
	},
	{
		id: "hybrid-10",
		text: "公海池中超过30天未跟进且曾对区块链技术感兴趣的公司",
		difficulty: 4,
		category: "混合搜索",
		description: "SQL条件：isPrivate=0，计算未跟进天数；语义：区块链技术",
		tables: ["companies", "followUps"],
	},
];
