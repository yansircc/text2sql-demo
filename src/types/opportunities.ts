import { z } from "zod/v4";

// 6. 商机表 Schema
export const opportunitiesSchema = z
	.object({
		id: z.number().describe("主键ID，自增").optional(),
		opportunityId: z
			.number()
			.describe("小满CRM商机ID，如4001、4002")
			.default(0),
		name: z
			.string()
			.max(500)
			.describe("商机名称，如'深圳科技创新-AI驱动CRM系统项目'")
			.default(""),
		serialId: z
			.string()
			.max(100)
			.describe("商机序列号，如'OPP-2024-001'")
			.optional(),
		companyId: z.number().describe("公司ID，关联companies表").default(0),
		mainUserId: z
			.string()
			.max(100)
			.describe("主负责人ID，如'user_001'")
			.default(""),
		amount: z.number().min(0).describe("商机金额，如580000、350000").default(0),
		currency: z
			.string()
			.max(10)
			.describe("币种，如'CNY'、'USD'")
			.default("CNY"),
		stageName: z
			.string()
			.max(100)
			.describe("销售阶段，如'需求确认'、'已成交'、'商务谈判'")
			.optional(),
		typeName: z
			.string()
			.max(100)
			.describe("商机类型，如'新客户'、'升级客户'")
			.optional(),
		originName: z
			.string()
			.max(100)
			.describe("商机来源，如'官网咨询'、'电话营销'、'行业展会'")
			.optional(),
		remark: z
			.string()
			.describe("商机备注，如'高价值项目，客户对AI功能需求强烈'")
			.optional(),
		createTime: z.number().describe("外部CRM创建时间戳（通常为空）").optional(),
		updateTime: z.number().describe("外部CRM更新时间戳（通常为空）").optional(),
		orderTime: z.number().describe("客户下单时间戳").optional(),
		createdAt: z
			.number()
			.describe("数据库记录创建时间戳（自动生成，用于统计分析）")
			.default(() => Math.floor(Date.now() / 1000)),
	})
	.describe(
		"商机表(text2sql_opportunities) - 存储销售商机信息，包括商机名称、金额、阶段、负责人等。追踪销售进展",
	);
