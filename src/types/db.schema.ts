import { z } from "zod/v4";
import { companiesSchema } from "./companies";
import { companyUserRelationsSchema } from "./company-user";
import { contactsSchema } from "./contacts";
import { followUpsSchema } from "./followups";
import { opportunitiesSchema } from "./opportunities";
import { salesUsersSchema } from "./sales-users";
import { whatsappMessagesSchema } from "./whatsapp-messages";

// 表信息映射 - 包含实际数据库表名和描述
export const tableInfo = {
	companies: {
		name: "text2sql_companies",
		description:
			"公司客户表(text2sql_companies) - 存储客户公司的基本信息，包括公司名称、联系方式、地址、客户状态等。支持公海/私海客户管理",
		schema: companiesSchema,
	},
	contacts: {
		name: "text2sql_contacts",
		description:
			"联系人表(text2sql_contacts) - 存储客户公司的联系人信息，包括姓名、邮箱、电话、职位等。每个联系人关联一个公司",
		schema: contactsSchema,
	},
	salesUsers: {
		name: "text2sql_sales_users",
		description:
			"业务员表(text2sql_sales_users) - 存储销售人员信息，包括姓名、昵称、头像、部门等。用于跟踪客户负责人",
		schema: salesUsersSchema,
	},
	companyUserRelations: {
		name: "text2sql_company_user_relations",
		description:
			"客户-业务员关系表(text2sql_company_user_relations) - 记录客户公司与业务员的关系，支持一个客户有多个负责人或协作者",
		schema: companyUserRelationsSchema,
	},
	followUps: {
		name: "text2sql_follow_ups",
		description:
			"跟进动态表(text2sql_follow_ups) - 记录销售人员对客户的跟进记录，包括跟进内容、时间、类型等",
		schema: followUpsSchema,
	},
	opportunities: {
		name: "text2sql_opportunities",
		description:
			"商机表(text2sql_opportunities) - 存储销售商机信息，包括商机名称、金额、阶段、负责人等。追踪销售进展",
		schema: opportunitiesSchema,
	},
	whatsappMessages: {
		name: "text2sql_whatsapp_messages",
		description:
			"WhatsApp消息表(text2sql_whatsapp_messages) - 存储WhatsApp聊天消息记录，包括消息内容、发送方、接收方、时间等",
		schema: whatsappMessagesSchema,
	},
} as const;

// 生成 JSON Schema 的工具函数 - 包含表描述信息
export function generateJsonSchema() {
	const schema: Record<string, any> = {};

	for (const [key, tableData] of Object.entries(tableInfo)) {
		const jsonSchema = z.toJSONSchema(tableData.schema);
		// 使用实际的数据库表名作为键，而不是 tableInfo 的键
		schema[tableData.name] = {
			...jsonSchema,
			title: tableData.name,
			description: tableData.description,
		};
	}

	return schema;
}

// 获取表信息的辅助函数
export function getTableDescriptions() {
	return Object.fromEntries(
		Object.entries(tableInfo).map(([key, info]) => [key, info.description]),
	);
}

// 导出类型
export type Company = z.infer<typeof companiesSchema>;
export type Contact = z.infer<typeof contactsSchema>;
export type SalesUser = z.infer<typeof salesUsersSchema>;
export type CompanyUserRelation = z.infer<typeof companyUserRelationsSchema>;
export type FollowUp = z.infer<typeof followUpsSchema>;
export type Opportunity = z.infer<typeof opportunitiesSchema>;
export type WhatsappMessage = z.infer<typeof whatsappMessagesSchema>;
