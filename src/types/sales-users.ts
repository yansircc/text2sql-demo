import { z } from "zod/v4";

// 3. 业务员表 Schema
export const salesUsersSchema = z
	.object({
		id: z.number().describe("主键ID，自增").optional(),
		userId: z
			.string()
			.max(100)
			.describe("小满CRM用户ID，如'user_001'")
			.default(""),
		nickname: z
			.string()
			.max(100)
			.describe("用户昵称，如'张三'、'李四'")
			.default(""),
		name: z
			.string()
			.max(100)
			.describe("真实姓名，如'张三丰'、'李思雨'")
			.optional(),
		avatar: z
			.string()
			.max(500)
			.url()
			.describe("头像URL，如Dicebear生成的头像")
			.optional(),
		departmentName: z
			.string()
			.max(100)
			.describe("部门名称，如'销售一部'、'客户成功部'")
			.optional(),
		createdAt: z
			.number()
			.describe("员工入职记录时间戳（自动生成）")
			.default(() => Math.floor(Date.now() / 1000)),
	})
	.describe(
		"业务员表(text2sql_sales_users) - 存储销售人员信息，包括姓名、昵称、头像、部门等。用于跟踪客户负责人",
	);
