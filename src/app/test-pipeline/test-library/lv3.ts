import type { QueryTask } from "../constants";

export const lv3: QueryTask[] = [
	// 公司-联系人-WhatsApp消息
	{
		id: "3-1-1",
		text: "找出通过WhatsApp联系最频繁的客户公司",
		difficulty: 3,
		category: "沟通频率",
		description: "三表关联消息统计",
		tables: ["companies", "contacts", "whatsappMessages"],
	},
	{
		id: "3-1-2",
		text: "统计有WhatsApp沟通的客户公司数量",
		difficulty: 3,
		category: "沟通覆盖",
		description: "去重计数统计",
		tables: ["companies", "contacts", "whatsappMessages"],
	},
	{
		id: "3-1-3",
		text: "查询WhatsApp回复率最高的客户",
		difficulty: 3,
		category: "响应分析",
		description: "回复率计算排序",
		tables: ["companies", "contacts", "whatsappMessages"],
	},
	{
		id: "3-1-4",
		text: "找出WhatsApp消息量最大的公司联系人",
		difficulty: 3,
		category: "活跃度排序",
		description: "联系人消息量排序",
		tables: ["companies", "contacts", "whatsappMessages"],
	},
	{
		id: "3-1-5",
		text: "统计每个公司主联系人的WhatsApp活跃度",
		difficulty: 3,
		category: "主联系人分析",
		description: "主联系人消息统计",
		tables: ["companies", "contacts", "whatsappMessages"],
	},
	{
		id: "3-1-6",
		text: "查询最近一周有WhatsApp沟通的公司和联系人",
		difficulty: 3,
		category: "时间范围分析",
		description: "时间筛选统计",
		tables: ["companies", "contacts", "whatsappMessages"],
	},

	// 公司-业务员-跟进记录
	{
		id: "3-2-1",
		text: "统计每个业务员对其客户的跟进密度",
		difficulty: 3,
		category: "跟进分析",
		description: "密度计算分析",
		tables: ["companies", "salesUsers", "followUps"],
	},
	{
		id: "3-2-2",
		text: "找出跟进最及时的销售团队",
		difficulty: 3,
		category: "团队绩效",
		description: "及时性分析排序",
		tables: ["companies", "salesUsers", "followUps"],
	},
	{
		id: "3-2-3",
		text: "查询客户满意度最高的业务员(基于跟进频率)",
		difficulty: 3,
		category: "满意度分析",
		description: "跟进质量评估",
		tables: ["companies", "salesUsers", "followUps"],
	},
	{
		id: "3-2-4",
		text: "找出需要加强跟进的客户-业务员组合",
		difficulty: 3,
		category: "预警分析",
		description: "跟进不足识别",
		tables: ["companies", "salesUsers", "followUps"],
	},
	{
		id: "3-2-5",
		text: "统计各部门对不同国家客户的跟进分布",
		difficulty: 3,
		category: "地域分析",
		description: "部门地域跟进统计",
		tables: ["companies", "salesUsers", "followUps"],
	},
	{
		id: "3-2-6",
		text: "查询跟进内容最丰富的业务员排行",
		difficulty: 3,
		category: "内容质量",
		description: "跟进内容长度分析",
		tables: ["companies", "salesUsers", "followUps"],
	},

	// 公司-业务员-商机
	{
		id: "3-3-1",
		text: "统计每个业务员的客户转化率",
		difficulty: 3,
		category: "转化分析",
		description: "转化率计算",
		tables: ["companies", "salesUsers", "opportunities"],
	},
	{
		id: "3-3-2",
		text: "找出商机开发能力最强的业务员",
		difficulty: 3,
		category: "开发能力",
		description: "商机开发效率",
		tables: ["companies", "salesUsers", "opportunities"],
	},
	{
		id: "3-3-3",
		text: "查询各部门的客户价值贡献",
		difficulty: 3,
		category: "价值贡献",
		description: "部门价值统计",
		tables: ["companies", "salesUsers", "opportunities"],
	},
	{
		id: "3-3-4",
		text: "找出平均商机价值最高的业务员",
		difficulty: 3,
		category: "价值分析",
		description: "平均价值排序",
		tables: ["companies", "salesUsers", "opportunities"],
	},
	{
		id: "3-3-5",
		text: "统计不同国家客户的商机成功率和负责业务员",
		difficulty: 3,
		category: "地域成功率",
		description: "国家维度成功率",
		tables: ["companies", "salesUsers", "opportunities"],
	},
	{
		id: "3-3-6",
		text: "查询私海客户与公海客户的商机价值对比",
		difficulty: 3,
		category: "客户类型对比",
		description: "私海公海价值分析",
		tables: ["companies", "salesUsers", "opportunities"],
	},

	// 公司-联系人-跟进记录
	{
		id: "3-4-1",
		text: "找出被跟进最多的客户联系人",
		difficulty: 3,
		category: "跟进对象",
		description: "联系人跟进统计",
		tables: ["companies", "contacts", "followUps"],
	},
	{
		id: "3-4-2",
		text: "统计联系人级别的跟进效果",
		difficulty: 3,
		category: "跟进效果",
		description: "联系人维度分析",
		tables: ["companies", "contacts", "followUps"],
	},
	{
		id: "3-4-3",
		text: "查询主联系人与普通联系人的跟进差异",
		difficulty: 3,
		category: "差异分析",
		description: "角色跟进对比",
		tables: ["companies", "contacts", "followUps"],
	},
	{
		id: "3-4-4",
		text: "找出跟进后响应最积极的联系人",
		difficulty: 3,
		category: "响应分析",
		description: "跟进响应评估",
		tables: ["companies", "contacts", "followUps"],
	},
	{
		id: "3-4-5",
		text: "统计各职位联系人的跟进接受度",
		difficulty: 3,
		category: "职位分析",
		description: "职位维度跟进分析",
		tables: ["companies", "contacts", "followUps"],
	},
	{
		id: "3-4-6",
		text: "查询不同时区客户联系人的最佳跟进时间",
		difficulty: 3,
		category: "时区优化",
		description: "时区跟进效果分析",
		tables: ["companies", "contacts", "followUps"],
	},

	// 公司-联系人-商机
	{
		id: "3-5-1",
		text: "找出最能带来商机的客户联系人",
		difficulty: 3,
		category: "商机贡献",
		description: "联系人商机贡献度",
		tables: ["companies", "contacts", "opportunities"],
	},
	{
		id: "3-5-2",
		text: "统计主联系人与普通联系人的商机转化差异",
		difficulty: 3,
		category: "角色转化分析",
		description: "联系人角色商机对比",
		tables: ["companies", "contacts", "opportunities"],
	},
	{
		id: "3-5-3",
		text: "查询不同职位联系人关联的商机价值分布",
		difficulty: 3,
		category: "职位价值分析",
		description: "职位商机价值统计",
		tables: ["companies", "contacts", "opportunities"],
	},
	{
		id: "3-5-4",
		text: "找出商机金额最大的客户公司及其关键联系人",
		difficulty: 3,
		category: "关键联系人",
		description: "高价值联系人识别",
		tables: ["companies", "contacts", "opportunities"],
	},
	{
		id: "3-5-5",
		text: "统计有邮箱联系人的公司商机成功率",
		difficulty: 3,
		category: "联系方式效果",
		description: "邮箱联系商机分析",
		tables: ["companies", "contacts", "opportunities"],
	},
	{
		id: "3-5-6",
		text: "查询各国家客户的联系人数量与商机关系",
		difficulty: 3,
		category: "联系人规模效应",
		description: "联系人数量商机相关性",
		tables: ["companies", "contacts", "opportunities"],
	},

	// 公司-关系表-业务员
	{
		id: "3-6-1",
		text: "统计每个业务员负责的客户数量和协作客户数量",
		difficulty: 3,
		category: "责任分配",
		description: "负责与协作客户统计",
		tables: ["companies", "companyUserRelations", "salesUsers"],
	},
	{
		id: "3-6-2",
		text: "查询各部门的客户分配均衡度",
		difficulty: 3,
		category: "分配均衡",
		description: "部门客户分配分析",
		tables: ["companies", "companyUserRelations", "salesUsers"],
	},
	{
		id: "3-6-3",
		text: "找出协作客户最多的业务员团队",
		difficulty: 3,
		category: "团队协作",
		description: "协作关系分析",
		tables: ["companies", "companyUserRelations", "salesUsers"],
	},
	{
		id: "3-6-4",
		text: "统计不同国家客户的业务员覆盖情况",
		difficulty: 3,
		category: "地域覆盖",
		description: "国家业务员分布",
		tables: ["companies", "companyUserRelations", "salesUsers"],
	},
	{
		id: "3-6-5",
		text: "查询私海客户的主负责人分布",
		difficulty: 3,
		category: "私海管理",
		description: "私海客户负责人统计",
		tables: ["companies", "companyUserRelations", "salesUsers"],
	},
	{
		id: "3-6-6",
		text: "找出客户流失风险高的业务员(基于客户分配变化)",
		difficulty: 3,
		category: "流失风险",
		description: "客户分配变化分析",
		tables: ["companies", "companyUserRelations", "salesUsers"],
	},

	// 联系人-跟进-业务员
	{
		id: "3-7-1",
		text: "统计业务员对不同职位联系人的跟进策略",
		difficulty: 3,
		category: "跟进策略",
		description: "职位维度跟进分析",
		tables: ["contacts", "followUps", "salesUsers"],
	},
	{
		id: "3-7-2",
		text: "查询各部门业务员的联系人跟进覆盖率",
		difficulty: 3,
		category: "跟进覆盖",
		description: "部门跟进覆盖分析",
		tables: ["contacts", "followUps", "salesUsers"],
	},
	{
		id: "3-7-3",
		text: "找出最善于维护主联系人关系的业务员",
		difficulty: 3,
		category: "关系维护",
		description: "主联系人维护能力",
		tables: ["contacts", "followUps", "salesUsers"],
	},
	{
		id: "3-7-4",
		text: "统计不同性别联系人的业务员跟进偏好",
		difficulty: 3,
		category: "性别偏好",
		description: "性别维度跟进分析",
		tables: ["contacts", "followUps", "salesUsers"],
	},
	{
		id: "3-7-5",
		text: "查询跟进频率最高的联系人-业务员配对",
		difficulty: 3,
		category: "配对分析",
		description: "高频跟进配对识别",
		tables: ["contacts", "followUps", "salesUsers"],
	},

	// 联系人-WhatsApp-业务员
	{
		id: "3-8-1",
		text: "统计业务员通过WhatsApp联系不同职位联系人的效果",
		difficulty: 3,
		category: "沟通效果",
		description: "WhatsApp职位沟通分析",
		tables: ["contacts", "whatsappMessages", "salesUsers"],
	},
	{
		id: "3-8-2",
		text: "查询WhatsApp响应最快的联系人类型和对应业务员",
		difficulty: 3,
		category: "响应速度",
		description: "WhatsApp响应速度分析",
		tables: ["contacts", "whatsappMessages", "salesUsers"],
	},
	{
		id: "3-8-3",
		text: "找出最活跃的WhatsApp沟通联系人-业务员组合",
		difficulty: 3,
		category: "活跃组合",
		description: "WhatsApp活跃配对",
		tables: ["contacts", "whatsappMessages", "salesUsers"],
	},
	{
		id: "3-8-4",
		text: "统计各部门业务员的WhatsApp联系人覆盖情况",
		difficulty: 3,
		category: "覆盖分析",
		description: "部门WhatsApp覆盖率",
		tables: ["contacts", "whatsappMessages", "salesUsers"],
	},

	// 商机-跟进-业务员
	{
		id: "3-9-1",
		text: "统计业务员的商机跟进密度与成功率关系",
		difficulty: 3,
		category: "跟进成功率",
		description: "商机跟进成功率分析",
		tables: ["opportunities", "followUps", "salesUsers"],
	},
	{
		id: "3-9-2",
		text: "查询高价值商机的跟进策略分布",
		difficulty: 3,
		category: "价值策略",
		description: "高价值商机跟进分析",
		tables: ["opportunities", "followUps", "salesUsers"],
	},
	{
		id: "3-9-3",
		text: "找出商机转化周期最短的业务员",
		difficulty: 3,
		category: "转化周期",
		description: "商机转化效率分析",
		tables: ["opportunities", "followUps", "salesUsers"],
	},
	{
		id: "3-9-4",
		text: "统计不同阶段商机的跟进强度要求",
		difficulty: 3,
		category: "阶段跟进",
		description: "商机阶段跟进分析",
		tables: ["opportunities", "followUps", "salesUsers"],
	},
	{
		id: "3-9-5",
		text: "查询各部门在不同商机类型上的跟进表现",
		difficulty: 3,
		category: "类型表现",
		description: "部门商机类型跟进",
		tables: ["opportunities", "followUps", "salesUsers"],
	},

	// 商机-联系人-WhatsApp
	{
		id: "3-10-1",
		text: "统计通过WhatsApp沟通产生的商机价值",
		difficulty: 3,
		category: "沟通价值",
		description: "WhatsApp商机价值分析",
		tables: ["opportunities", "contacts", "whatsappMessages"],
	},
	{
		id: "3-10-2",
		text: "查询WhatsApp活跃联系人的商机转化率",
		difficulty: 3,
		category: "活跃转化",
		description: "WhatsApp活跃度转化分析",
		tables: ["opportunities", "contacts", "whatsappMessages"],
	},
	{
		id: "3-10-3",
		text: "找出最能通过WhatsApp促成商机的联系人职位",
		difficulty: 3,
		category: "职位促成",
		description: "职位WhatsApp商机分析",
		tables: ["opportunities", "contacts", "whatsappMessages"],
	},
	{
		id: "3-10-4",
		text: "统计商机谈判期间的WhatsApp沟通频率变化",
		difficulty: 3,
		category: "谈判沟通",
		description: "商机期间沟通变化",
		tables: ["opportunities", "contacts", "whatsappMessages"],
	},
];
