import { generateJsonSchema } from "@/types/db.schema";

// 使用真实的数据库 schema
export const realDatabaseSchema = JSON.stringify(generateJsonSchema());

// 为了兼容性，保留 mockDatabaseSchema 的名称，但使用真实数据
export const mockDatabaseSchema = realDatabaseSchema;

export const exampleQueries = [
	{ text: "显示所有公司客户", label: "显示所有公司客户" },
	{ text: "找出今天新增的跟进记录", label: "找出今天新增的跟进记录" },
	{
		text: "查找名称类似华为的公司",
		label: "查找名称类似华为的公司（语义搜索）",
	},
	{
		text: "统计每个业务员的客户数量和商机总金额",
		label: "统计每个业务员的客户数量和商机总金额（复杂查询）",
	},
	{ text: "显示商机", label: "显示商机（不清晰查询）" },
	{ text: "查看张三负责的所有客户及其联系人", label: "多表关联查询" },
	{ text: "本月新增的商机有哪些", label: "时间范围查询" },
];
