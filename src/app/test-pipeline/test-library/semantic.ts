import type { QueryTask } from "../constants";

/**
 * 纯语义搜索查询
 * 这些查询需要理解语义、同义词和相似概念，无法通过SQL LIKE精确匹配解决
 * 主要依赖向量化字段：requiredProducts19978277361（客户需求产品）和 remark（备注）
 */
export const semantic: QueryTask[] = [
	{
		id: "semantic-1",
		text: "寻找做类似云计算业务的企业",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解'类似云计算'包括云存储、云服务、SaaS等相关概念",
		tables: ["companies"],
	},
	{
		id: "semantic-2",
		text: "查找需要人工智能解决方案的公司",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解AI、机器学习、深度学习等同义词和相关概念",
		tables: ["companies"],
	},
	{
		id: "semantic-3",
		text: "找出对数字化转型感兴趣的客户",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解数字化转型涵盖的各种技术和业务概念",
		tables: ["companies"],
	},
	{
		id: "semantic-4",
		text: "列出需要企业管理软件的公司",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解ERP、CRM、HRM等都属于企业管理软件",
		tables: ["companies"],
	},
	{
		id: "semantic-5",
		text: "查找在寻找物联网解决方案的企业",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解IoT、智能设备、传感器网络等相关概念",
		tables: ["companies"],
	},
	{
		id: "semantic-6",
		text: "找出需要网络安全服务的客户",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解防火墙、加密、安全审计等相关概念",
		tables: ["companies"],
	},
	{
		id: "semantic-7",
		text: "查询对区块链技术有需求的公司",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解分布式账本、加密货币、智能合约等概念",
		tables: ["companies"],
	},
	{
		id: "semantic-8",
		text: "列出需要数据分析平台的企业",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解BI、大数据、数据挖掘等相关技术",
		tables: ["companies"],
	},
	{
		id: "semantic-9",
		text: "找出对自动化办公有兴趣的客户",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解RPA、工作流自动化、智能办公等概念",
		tables: ["companies"],
	},
	{
		id: "semantic-10",
		text: "查找需要远程协作工具的公司",
		difficulty: 1,
		category: "语义搜索",
		description: "需要理解视频会议、项目管理、在线协作等相关产品",
		tables: ["companies"],
	},
];
