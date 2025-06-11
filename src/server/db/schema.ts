// CRM 数据库 Schema - 基于小满CRM系统设计
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTableCreator,
	text,
} from "drizzle-orm/sqlite-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator((name) => `text2sql_${name}`);

// 1. 公司客户表
export const companies = createTable(
	"companies",
	(d) => ({
		id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		companyId: d.integer().unique().notNull(), // 小满CRM系统ID
		name: d.text({ length: 500 }).notNull(), // 公司名称
		serialId: d.text({ length: 100 }), // 序列号
		shortName: d.text({ length: 200 }), // 简称
		country: d.text({ length: 10 }), // 国家代码
		countryName: d.text({ length: 100 }), // 国家名称
		timezone: d.text({ length: 50 }), // 时区
		poolName: d.text({ length: 100 }), // 公海/私海池名称
		groupName: d.text({ length: 100 }), // 客户分组
		trailStatus: d.text({ length: 50 }), // 跟进状态
		star: d.integer().default(0), // 星级
		homepage: d.text({ length: 500 }), // 官网
		address: d.text({ length: 1000 }), // 地址
		remark: d.text(), // 备注
		createTime: d.integer({ mode: "timestamp" }), // 创建时间
		updateTime: d.integer({ mode: "timestamp" }), // 更新时间
		privateTime: d.integer({ mode: "timestamp" }), // 转私海时间
		publicTime: d.integer({ mode: "timestamp" }), // 转公海时间
		isPrivate: d.integer().default(0), // 是否私海 (0=公海, 1=私海)
		// 自定义字段
		customerRecycle42349295325607: d.text(), // 客户回收
		quoteCustomer42086173429707: d.text(), // 报价客户
		hasWebsite20753699812867: d.text(), // 是否有网站
		searchKeywords7375691812971: d.text(), // 客户搜索的关键词
		mainBusiness7375678270531: d.text(), // 客户公司主营业务
		inquiryKeywords22467658539: d.text(), // 询盘关键词
		requiredProducts19978277361: d.text(), // 客户需求产品
		publicAllocation19977530773: d.text(), // 公海客户分配
		createdAt: d
			.integer({ mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	}),
	(t) => [
		index("companies_company_id_idx").on(t.companyId),
		index("companies_name_idx").on(t.name),
		index("companies_country_idx").on(t.country),
		index("companies_is_private_idx").on(t.isPrivate),
	],
);

// 2. 联系人表
export const contacts = createTable(
	"contacts",
	(d) => ({
		id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		customerId: d.integer().unique().notNull(), // 小满CRM联系人ID
		companyId: d
			.integer()
			.notNull()
			.references(() => companies.companyId), // 关联公司ID
		name: d.text({ length: 200 }).notNull(), // 联系人姓名
		email: d.text({ length: 255 }), // 邮箱
		gender: d.integer().default(0), // 性别 (0=未知, 1=男, 2=女)
		post: d.text({ length: 100 }), // 职位
		whatsapp: d.text({ length: 50 }), // WhatsApp号码
		telAreaCode: d.text({ length: 10 }), // 电话区号
		tel: d.text({ length: 50 }), // 电话号码
		isMain: d.integer().default(0), // 是否主联系人
		remark: d.text(), // 备注
		createdAt: d
			.integer({ mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	}),
	(t) => [
		index("contacts_customer_id_idx").on(t.customerId),
		index("contacts_company_id_idx").on(t.companyId),
		index("contacts_email_idx").on(t.email),
		index("contacts_whatsapp_idx").on(t.whatsapp),
	],
);

// 3. 业务员表
export const salesUsers = createTable(
	"sales_users",
	(d) => ({
		id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		userId: d.text({ length: 100 }).unique().notNull(), // 小满CRM用户ID
		nickname: d.text({ length: 100 }).notNull(), // 昵称
		name: d.text({ length: 100 }), // 真实姓名
		avatar: d.text({ length: 500 }), // 头像URL
		departmentName: d.text({ length: 100 }), // 部门名称
		createdAt: d
			.integer({ mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	}),
	(t) => [
		index("sales_users_user_id_idx").on(t.userId),
		index("sales_users_nickname_idx").on(t.nickname),
	],
);

// 4. 客户-业务员关系表
export const companyUserRelations = createTable(
	"company_user_relations",
	(d) => ({
		id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		companyId: d
			.integer()
			.notNull()
			.references(() => companies.companyId), // 公司ID
		userId: d
			.text({ length: 100 })
			.notNull()
			.references(() => salesUsers.userId), // 业务员ID
		relationType: d.text({ length: 50 }).default("owner"), // 关系类型: owner, collaborator
		createdAt: d
			.integer({ mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	}),
	(t) => [
		index("company_user_relations_company_id_idx").on(t.companyId),
		index("company_user_relations_user_id_idx").on(t.userId),
	],
);

// 5. 跟进动态表
export const followUps = createTable(
	"follow_ups",
	(d) => ({
		id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		followUpId: d.integer().unique().notNull(), // 小满CRM跟进ID
		companyId: d
			.integer()
			.notNull()
			.references(() => companies.companyId), // 公司ID
		customerId: d.integer().references(() => contacts.customerId), // 联系人ID
		opportunityId: d.integer(), // 商机ID
		userId: d
			.text({ length: 100 })
			.notNull()
			.references(() => salesUsers.userId), // 业务员ID
		content: d.text().notNull(), // 跟进内容
		type: d.integer().default(101), // 跟进类型
		createTime: d.integer({ mode: "timestamp" }), // 创建时间
		createdAt: d
			.integer({ mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	}),
	(t) => [
		index("follow_ups_company_id_idx").on(t.companyId),
		index("follow_ups_user_id_idx").on(t.userId),
		index("follow_ups_create_time_idx").on(t.createTime),
	],
);

// 6. 商机表
export const opportunities = createTable(
	"opportunities",
	(d) => ({
		id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		opportunityId: d.integer().unique().notNull(), // 小满CRM商机ID
		name: d.text({ length: 500 }).notNull(), // 商机名称
		serialId: d.text({ length: 100 }), // 序列号
		companyId: d
			.integer()
			.notNull()
			.references(() => companies.companyId), // 公司ID
		mainUserId: d
			.text({ length: 100 })
			.notNull()
			.references(() => salesUsers.userId), // 主负责人ID
		amount: d.real().default(0), // 金额
		currency: d.text({ length: 10 }).default("USD"), // 币种
		stageName: d.text({ length: 100 }), // 阶段名称
		typeName: d.text({ length: 100 }), // 商机类型
		originName: d.text({ length: 100 }), // 来源
		remark: d.text(), // 备注
		createTime: d.integer({ mode: "timestamp" }), // 创建时间
		updateTime: d.integer({ mode: "timestamp" }), // 更新时间
		orderTime: d.integer({ mode: "timestamp" }), // 下单时间
		createdAt: d
			.integer({ mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	}),
	(t) => [
		index("opportunities_company_id_idx").on(t.companyId),
		index("opportunities_main_user_id_idx").on(t.mainUserId),
		index("opportunities_amount_idx").on(t.amount),
	],
);

// 7. WhatsApp消息表
export const whatsappMessages = createTable(
	"whatsapp_messages",
	(d) => ({
		id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		messageId: d.text({ length: 200 }).unique().notNull(), // WhatsApp消息ID
		timestamp: d.integer().notNull(), // 时间戳
		fromNumber: d.text({ length: 50 }).notNull(), // 发送方号码
		toNumber: d.text({ length: 50 }).notNull(), // 接收方号码
		body: d.text(), // 消息内容
		fromMe: d.integer().notNull(), // 是否我方发送 (0=收到, 1=发出)
		contactName: d.text({ length: 200 }), // 联系人姓名
		hasMedia: d.integer().default(0), // 是否包含媒体文件
		ack: d.integer().default(0), // 消息状态
		createdAt: d
			.integer({ mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	}),
	(t) => [
		index("whatsapp_from_number_idx").on(t.fromNumber),
		index("whatsapp_to_number_idx").on(t.toNumber),
		index("whatsapp_timestamp_idx").on(t.timestamp),
		index("whatsapp_from_me_idx").on(t.fromMe),
	],
);
