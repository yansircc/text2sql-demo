import { z } from "zod/v4";

// 2. 联系人表 Schema
export const contactsSchema = z
	.object({
		id: z.number().describe("主键ID，自增").optional(),
		customerId: z.number().describe("小满CRM联系人ID，如2001、2002").default(0),
		companyId: z.number().describe("关联的公司ID，关联companies表").default(0),
		name: z
			.string()
			.max(200)
			.describe("联系人姓名，如'刘总监'、'陈经理'")
			.meta({
				isVectorized: true,
			})
			.default(""),
		email: z
			.string()
			.max(255)
			.email()
			.describe("邮箱地址，如'刘总监@hotmail.com'")
			.optional(),
		gender: z
			.number()
			.min(0)
			.max(2)
			.describe("性别：0=未知，1=男性，2=女性")
			.default(1),
		post: z
			.string()
			.max(100)
			.describe("职位，如'技术总监'、'董事长'、'CEO'")
			.optional(),
		whatsapp: z
			.string()
			.max(50)
			.describe("WhatsApp号码，如'+86 161 2503 7773'")
			.optional(),
		telAreaCode: z.string().max(10).describe("电话区号（通常为空）").optional(),
		tel: z
			.string()
			.max(50)
			.describe("电话号码，如'+86 170 4371 8292'")
			.optional(),
		isMain: z
			.number()
			.min(0)
			.max(1)
			.describe("是否主联系人：0=普通联系人，1=主要决策人")
			.default(0),
		remark: z
			.string()
			.describe("联系人备注，如'技术决策人，对AI很感兴趣'")
			.meta({
				isVectorized: true,
			})
			.optional(),
		createdAt: z
			.number()
			.describe("记录创建时间戳（自动生成）")
			.default(() => Math.floor(Date.now() / 1000)),
	})
	.describe(
		"联系人表(text2sql_contacts) - 存储客户公司的联系人信息，包括姓名、邮箱、电话、职位等。每个联系人关联一个公司",
	);
