import { z } from "zod/v4";

// 1. 公司客户表 Schema
export const companiesSchema = z
	.object({
		id: z.number().describe("主键ID，自增").optional(),
		companyId: z
			.number()
			.describe("小满CRM系统中的公司ID，如1001、1002")
			.default(0),
		name: z
			.string()
			.max(500)
			.describe("公司全称，如'深圳市科技创新有限公司'")
			.default(""),
		serialId: z.string().max(100).describe("外部序列号（通常为空）").optional(),
		shortName: z
			.string()
			.max(200)
			.describe("公司简称，如'科技创新'、'贸易发展'")
			.optional(),
		country: z
			.string()
			.max(10)
			.describe("国家代码，如'CN'、'US'")
			.default("CN"),
		countryName: z
			.string()
			.max(100)
			.describe("国家名称，如'中国'、'美国'")
			.default("中国"),
		timezone: z
			.string()
			.max(50)
			.describe("时区，如'Asia/Shanghai'")
			.default("Asia/Shanghai"),
		poolName: z
			.string()
			.max(100)
			.describe("客户池名称，如'私海池'、'公海池'")
			.optional(),
		groupName: z
			.string()
			.max(100)
			.describe("行业分组，如'科技行业'、'贸易行业'、'教育行业'")
			.optional(),
		trailStatus: z
			.string()
			.max(50)
			.describe("跟进状态，如'跟进中'、'待跟进'、'已成交'、'暂停跟进'")
			.optional(),
		star: z
			.number()
			.min(0)
			.max(5)
			.describe("客户星级评价 (2-5星，数字越高越重要)")
			.default(3),
		homepage: z
			.string()
			.max(500)
			.describe("公司官网URL，如'https://www.techinnov.com'")
			.optional(),
		address: z
			.string()
			.max(1000)
			.describe("详细地址，如'深圳市南山区科技园'")
			.optional(),
		remark: z
			.string()
			.describe("客户备注，如'高潜力客户，重点关注'")
			.optional(),
		createTime: z
			.number()
			.describe("外部CRM系统同步的创建时间戳（通常为空）")
			.optional(),
		updateTime: z
			.number()
			.describe("外部CRM系统同步的更新时间戳（通常为空）")
			.optional(),
		privateTime: z.number().describe("转为私海的时间戳").optional(),
		publicTime: z.number().describe("转为公海的时间戳").optional(),
		isPrivate: z
			.number()
			.min(0)
			.max(1)
			.describe("客户归属状态：0=公海客户（共享），1=私海客户（独占）")
			.default(0),
		// 自定义字段
		customerRecycle42349295325607: z
			.string()
			.describe("客户回收状态（业务自定义字段）")
			.optional(),
		quoteCustomer42086173429707: z
			.string()
			.describe("报价客户标识（业务自定义字段）")
			.optional(),
		hasWebsite20753699812867: z
			.string()
			.describe("是否有官网，如'是'、'否'")
			.optional(),
		searchKeywords7375691812971: z
			.string()
			.describe("客户搜索关键词（营销来源追踪）")
			.optional(),
		mainBusiness7375678270531: z
			.string()
			.describe("主营业务，如'人工智能软件开发'、'国际贸易'")
			.optional(),
		inquiryKeywords22467658539: z
			.string()
			.describe("客户询盘时的关键词")
			.optional(),
		requiredProducts19978277361: z
			.string()
			.describe("客户需求产品，如'CRM系统，项目管理工具'")
			.optional(),
		publicAllocation19977530773: z
			.string()
			.describe("公海客户分配规则")
			.optional(),
		createdAt: z
			.number()
			.describe("数据库记录创建时间戳（自动生成，有实际数据，用于查询统计）")
			.default(() => Math.floor(Date.now() / 1000)),
	})
	.describe(
		"公司客户表(text2sql_companies) - 存储客户公司的基本信息，包括公司名称、联系方式、地址、客户状态等。支持公海/私海客户管理",
	);
