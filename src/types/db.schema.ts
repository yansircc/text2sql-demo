import { z } from "zod/v4";

// CRM 数据库 Zod Schema - 基于小满CRM系统设计
// 用于生成 JSON Schema 和数据验证

// 1. 公司客户表 Schema
export const companiesSchema = z.object({
	id: z.number().describe("主键ID，自增").optional(),
	companyId: z.number().describe("小满CRM系统中的公司ID").default(0),
	name: z.string().max(500).describe("公司名称").default(""),
	serialId: z.string().max(100).describe("序列号").optional(),
	shortName: z.string().max(200).describe("公司简称").optional(),
	country: z.string().max(10).describe("国家代码，如CN、US").optional(),
	countryName: z.string().max(100).describe("国家名称").optional(),
	timezone: z.string().max(50).describe("时区信息").optional(),
	poolName: z.string().max(100).describe("公海/私海池名称").optional(),
	groupName: z.string().max(100).describe("客户分组").optional(),
	trailStatus: z.string().max(50).describe("跟进状态").optional(),
	star: z.number().min(0).max(5).describe("星级评价 (0-5星)").default(0),
	homepage: z.string().max(500).describe("公司官网URL").optional(),
	address: z.string().max(1000).describe("公司地址").optional(),
	remark: z.string().describe("备注信息").optional(),
	createTime: z.number().describe("创建时间戳").optional(),
	updateTime: z.number().describe("更新时间戳").optional(),
	privateTime: z.number().describe("转私海时间戳").optional(),
	publicTime: z.number().describe("转公海时间戳").optional(),
	isPrivate: z
		.number()
		.min(0)
		.max(1)
		.describe("是否私海 (0=公海, 1=私海)")
		.default(0),
	// 自定义字段
	customerRecycle42349295325607: z.string().describe("客户回收状态").optional(),
	quoteCustomer42086173429707: z.string().describe("报价客户标识").optional(),
	hasWebsite20753699812867: z.string().describe("是否有网站").optional(),
	searchKeywords7375691812971: z
		.string()
		.describe("客户搜索的关键词")
		.optional(),
	mainBusiness7375678270531: z.string().describe("客户公司主营业务").optional(),
	inquiryKeywords22467658539: z.string().describe("询盘关键词").optional(),
	requiredProducts19978277361: z.string().describe("客户需求产品").optional(),
	publicAllocation19977530773: z.string().describe("公海客户分配").optional(),
	createdAt: z
		.number()
		.describe("记录创建时间戳")
		.default(() => Math.floor(Date.now() / 1000)),
});

// 2. 联系人表 Schema
export const contactsSchema = z.object({
	id: z.number().describe("主键ID，自增").optional(),
	customerId: z.number().describe("小满CRM联系人ID").default(0),
	companyId: z.number().describe("关联的公司ID").default(0),
	name: z.string().max(200).describe("联系人姓名").default(""),
	email: z.string().max(255).email().describe("邮箱地址").optional(),
	gender: z
		.number()
		.min(0)
		.max(2)
		.describe("性别 (0=未知, 1=男, 2=女)")
		.default(0),
	post: z.string().max(100).describe("职位").optional(),
	whatsapp: z.string().max(50).describe("WhatsApp号码").optional(),
	telAreaCode: z.string().max(10).describe("电话区号").optional(),
	tel: z.string().max(50).describe("电话号码").optional(),
	isMain: z
		.number()
		.min(0)
		.max(1)
		.describe("是否主联系人 (0=否, 1=是)")
		.default(0),
	remark: z.string().describe("备注信息").optional(),
	createdAt: z
		.number()
		.describe("记录创建时间戳")
		.default(() => Math.floor(Date.now() / 1000)),
});

// 3. 业务员表 Schema
export const salesUsersSchema = z.object({
	id: z.number().describe("主键ID，自增").optional(),
	userId: z.string().max(100).describe("小满CRM用户ID").default(""),
	nickname: z.string().max(100).describe("昵称").default(""),
	name: z.string().max(100).describe("真实姓名").optional(),
	avatar: z.string().max(500).url().describe("头像URL").optional(),
	departmentName: z.string().max(100).describe("部门名称").optional(),
	createdAt: z
		.number()
		.describe("记录创建时间戳")
		.default(() => Math.floor(Date.now() / 1000)),
});

// 4. 客户-业务员关系表 Schema
export const companyUserRelationsSchema = z.object({
	id: z.number().describe("主键ID，自增").optional(),
	companyId: z.number().describe("公司ID").default(0),
	userId: z.string().max(100).describe("业务员ID").default(""),
	relationType: z
		.string()
		.max(50)
		.describe("关系类型: owner(负责人), collaborator(协作者)")
		.default("owner"),
	createdAt: z
		.number()
		.describe("记录创建时间戳")
		.default(() => Math.floor(Date.now() / 1000)),
});

// 5. 跟进动态表 Schema
export const followUpsSchema = z.object({
	id: z.number().describe("主键ID，自增").optional(),
	followUpId: z.number().describe("小满CRM跟进ID").default(0),
	companyId: z.number().describe("公司ID").default(0),
	customerId: z.number().describe("联系人ID").optional(),
	opportunityId: z.number().describe("商机ID").optional(),
	userId: z.string().max(100).describe("业务员ID").default(""),
	content: z.string().describe("跟进内容").default(""),
	type: z.number().describe("跟进类型").default(101),
	createTime: z.number().describe("创建时间戳").optional(),
	createdAt: z
		.number()
		.describe("记录创建时间戳")
		.default(() => Math.floor(Date.now() / 1000)),
});

// 6. 商机表 Schema
export const opportunitiesSchema = z.object({
	id: z.number().describe("主键ID，自增").optional(),
	opportunityId: z.number().describe("小满CRM商机ID").default(0),
	name: z.string().max(500).describe("商机名称").default(""),
	serialId: z.string().max(100).describe("序列号").optional(),
	companyId: z.number().describe("公司ID").default(0),
	mainUserId: z.string().max(100).describe("主负责人ID").default(""),
	amount: z.number().min(0).describe("金额").default(0),
	currency: z.string().max(10).describe("币种").default("USD"),
	stageName: z.string().max(100).describe("阶段名称").optional(),
	typeName: z.string().max(100).describe("商机类型").optional(),
	originName: z.string().max(100).describe("来源").optional(),
	remark: z.string().describe("备注").optional(),
	createTime: z.number().describe("创建时间戳").optional(),
	updateTime: z.number().describe("更新时间戳").optional(),
	orderTime: z.number().describe("下单时间戳").optional(),
	createdAt: z
		.number()
		.describe("记录创建时间戳")
		.default(() => Math.floor(Date.now() / 1000)),
});

// 7. WhatsApp消息表 Schema
export const whatsappMessagesSchema = z.object({
	id: z.number().describe("主键ID，自增").optional(),
	messageId: z.string().max(200).describe("WhatsApp消息ID").default(""),
	timestamp: z.number().describe("消息时间戳").default(0),
	fromNumber: z.string().max(50).describe("发送方号码").default(""),
	toNumber: z.string().max(50).describe("接收方号码").default(""),
	body: z.string().describe("消息内容").optional(),
	fromMe: z
		.number()
		.min(0)
		.max(1)
		.describe("是否我方发送 (0=收到, 1=发出)")
		.default(0),
	contactName: z.string().max(200).describe("联系人姓名").optional(),
	hasMedia: z
		.number()
		.min(0)
		.max(1)
		.describe("是否包含媒体文件 (0=否, 1=是)")
		.default(0),
	ack: z.number().describe("消息状态").default(0),
	createdAt: z
		.number()
		.describe("记录创建时间戳")
		.default(() => Math.floor(Date.now() / 1000)),
});

// 生成 JSON Schema 的工具函数
export function generateJsonSchema() {
	return {
		companies: z.toJSONSchema(companiesSchema),
		contacts: z.toJSONSchema(contactsSchema),
		salesUsers: z.toJSONSchema(salesUsersSchema),
		companyUserRelations: z.toJSONSchema(companyUserRelationsSchema),
		followUps: z.toJSONSchema(followUpsSchema),
		opportunities: z.toJSONSchema(opportunitiesSchema),
		whatsappMessages: z.toJSONSchema(whatsappMessagesSchema),
	};
}

// 导出类型
export type Company = z.infer<typeof companiesSchema>;
export type Contact = z.infer<typeof contactsSchema>;
export type SalesUser = z.infer<typeof salesUsersSchema>;
export type CompanyUserRelation = z.infer<typeof companyUserRelationsSchema>;
export type FollowUp = z.infer<typeof followUpsSchema>;
export type Opportunity = z.infer<typeof opportunitiesSchema>;
export type WhatsappMessage = z.infer<typeof whatsappMessagesSchema>;
