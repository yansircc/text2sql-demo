import { z } from "zod/v4";

// 5. 跟进动态表 Schema
export const followUpsSchema = z
	.object({
		id: z.number().describe("主键ID，自增").optional(),
		followUpId: z.number().describe("小满CRM跟进ID，如3001、3002").default(0),
		companyId: z.number().describe("公司ID，关联companies表").default(0),
		customerId: z.number().describe("联系人ID，关联contacts表").optional(),
		opportunityId: z
			.number()
			.describe("商机ID，关联opportunities表")
			.optional(),
		userId: z.string().max(100).describe("业务员ID，如'user_001'").default(""),
		content: z
			.string()
			.describe("跟进内容，如'与客户技术总监进行了初步沟通...'")
			.meta({
				isVectorized: true,
			})
			.default(""),
		type: z
			.number()
			.describe("跟进类型：101=电话沟通，102=邮件跟进，103=会议")
			.default(101),
		createTime: z.number().describe("外部CRM创建时间戳（通常为空）").optional(),
		createdAt: z
			.number()
			.describe("数据库记录创建时间戳（自动生成，用于排序）")
			.default(() => Math.floor(Date.now() / 1000)),
	})
	.describe(
		"跟进动态表(text2sql_follow_ups) - 记录销售人员对客户的跟进记录，包括跟进内容、时间、类型等",
	);
