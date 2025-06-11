import { z } from "zod/v4";

// 4. 客户-业务员关系表 Schema
export const companyUserRelationsSchema = z
	.object({
		id: z.number().describe("主键ID，自增").optional(),
		companyId: z.number().describe("公司ID，关联companies表").default(0),
		userId: z.string().max(100).describe("业务员ID，如'user_001'").default(""),
		relationType: z
			.string()
			.max(50)
			.describe("关系类型：owner=主负责人，collaborator=协作者")
			.default("owner"),
		createdAt: z
			.number()
			.describe("关系建立时间戳（自动生成）")
			.default(() => Math.floor(Date.now() / 1000)),
	})
	.describe(
		"客户-业务员关系表(text2sql_company_user_relations) - 记录客户公司与业务员的关系，支持一个客户有多个负责人或协作者",
	);
