import type { QueryTask } from "../constants";

export const lv4: QueryTask[] = [
	// 公司-联系人-业务员-跟进记录
	{
		id: "4-1-1",
		text: "分析业务员对不同联系人的跟进策略",
		difficulty: 4,
		category: "策略分析",
		description: "跟进策略效果分析",
		tables: ["companies", "contacts", "salesUsers", "followUps"],
	},
	{
		id: "4-1-2",
		text: "找出联系人响应最好的业务员组合",
		difficulty: 4,
		category: "组合优化",
		description: "最佳搭配识别",
		tables: ["companies", "contacts", "salesUsers", "followUps"],
	},
	{
		id: "4-1-3",
		text: "统计各部门业务员在不同国家客户联系人的跟进成效",
		difficulty: 4,
		category: "地域成效",
		description: "跨国跟进效果分析",
		tables: ["companies", "contacts", "salesUsers", "followUps"],
	},
	{
		id: "4-1-4",
		text: "分析主联系人与普通联系人在不同业务员跟进下的响应差异",
		difficulty: 4,
		category: "角色响应差异",
		description: "联系人角色跟进分析",
		tables: ["companies", "contacts", "salesUsers", "followUps"],
	},
	{
		id: "4-1-5",
		text: "找出跟进频率与联系人职位匹配度最高的业务员",
		difficulty: 4,
		category: "匹配度分析",
		description: "职位跟进匹配优化",
		tables: ["companies", "contacts", "salesUsers", "followUps"],
	},

	// 公司-业务员-商机-跟进记录
	{
		id: "4-2-1",
		text: "分析跟进活动对商机转化的具体影响",
		difficulty: 4,
		category: "转化分析",
		description: "跟进与转化关联",
		tables: ["companies", "salesUsers", "opportunities", "followUps"],
	},
	{
		id: "4-2-2",
		text: "找出商机跟进ROI最高的业务员",
		difficulty: 4,
		category: "ROI分析",
		description: "投入产出比计算",
		tables: ["companies", "salesUsers", "opportunities", "followUps"],
	},
	{
		id: "4-2-3",
		text: "统计不同商机阶段的最优跟进策略和负责业务员",
		difficulty: 4,
		category: "阶段策略",
		description: "商机阶段跟进优化",
		tables: ["companies", "salesUsers", "opportunities", "followUps"],
	},
	{
		id: "4-2-4",
		text: "分析高价值商机的跟进密度与成功率关系",
		difficulty: 4,
		category: "价值密度分析",
		description: "高价值商机跟进策略",
		tables: ["companies", "salesUsers", "opportunities", "followUps"],
	},
	{
		id: "4-2-5",
		text: "找出在私海客户商机转化中表现最佳的业务员",
		difficulty: 4,
		category: "私海转化",
		description: "私海商机转化专家",
		tables: ["companies", "salesUsers", "opportunities", "followUps"],
	},

	// 公司-联系人-商机-跟进记录
	{
		id: "4-3-1",
		text: "分析联系人参与度对商机的影响",
		difficulty: 4,
		category: "参与度分析",
		description: "联系人价值评估",
		tables: ["companies", "contacts", "opportunities", "followUps"],
	},
	{
		id: "4-3-2",
		text: "找出最有价值的客户联系人组合",
		difficulty: 4,
		category: "价值识别",
		description: "高价值联系人",
		tables: ["companies", "contacts", "opportunities", "followUps"],
	},
	{
		id: "4-3-3",
		text: "统计主联系人跟进频率对商机推进速度的影响",
		difficulty: 4,
		category: "推进速度",
		description: "主联系人商机推进分析",
		tables: ["companies", "contacts", "opportunities", "followUps"],
	},
	{
		id: "4-3-4",
		text: "分析不同职位联系人的商机贡献度与跟进投入比",
		difficulty: 4,
		category: "职位贡献度",
		description: "职位价值投入分析",
		tables: ["companies", "contacts", "opportunities", "followUps"],
	},
	{
		id: "4-3-5",
		text: "找出最能通过跟进促成大额商机的客户联系人特征",
		difficulty: 4,
		category: "大额商机特征",
		description: "高价值客户特征分析",
		tables: ["companies", "contacts", "opportunities", "followUps"],
	},

	// 联系人-业务员-WhatsApp-跟进记录
	{
		id: "4-4-1",
		text: "分析WhatsApp沟通对跟进效果的影响",
		difficulty: 4,
		category: "渠道效果",
		description: "多渠道效果对比",
		tables: ["contacts", "salesUsers", "whatsappMessages", "followUps"],
	},
	{
		id: "4-4-2",
		text: "找出WhatsApp+跟进组合效果最好的业务员",
		difficulty: 4,
		category: "组合效果",
		description: "最佳沟通组合",
		tables: ["contacts", "salesUsers", "whatsappMessages", "followUps"],
	},
	{
		id: "4-4-3",
		text: "统计WhatsApp回复速度对后续跟进成功率的影响",
		difficulty: 4,
		category: "回复速度效应",
		description: "响应速度跟进关联",
		tables: ["contacts", "salesUsers", "whatsappMessages", "followUps"],
	},
	{
		id: "4-4-4",
		text: "分析不同职位联系人的WhatsApp与传统跟进偏好差异",
		difficulty: 4,
		category: "沟通偏好",
		description: "职位沟通方式偏好",
		tables: ["contacts", "salesUsers", "whatsappMessages", "followUps"],
	},

	// 公司-业务员-商机-WhatsApp
	{
		id: "4-5-1",
		text: "分析WhatsApp沟通对商机发展的推动作用",
		difficulty: 4,
		category: "推动分析",
		description: "沟通对商机影响",
		tables: ["companies", "salesUsers", "opportunities", "whatsappMessages"],
	},
	{
		id: "4-5-2",
		text: "找出通过WhatsApp获得商机最多的业务员",
		difficulty: 4,
		category: "获客分析",
		description: "WhatsApp商机转化",
		tables: ["companies", "salesUsers", "opportunities", "whatsappMessages"],
	},
	{
		id: "4-5-3",
		text: "统计WhatsApp沟通频率与商机价值的相关性",
		difficulty: 4,
		category: "频率价值关联",
		description: "沟通频率商机价值分析",
		tables: ["companies", "salesUsers", "opportunities", "whatsappMessages"],
	},
	{
		id: "4-5-4",
		text: "分析各国家客户的WhatsApp商机转化效率和最佳业务员",
		difficulty: 4,
		category: "地域转化效率",
		description: "国家WhatsApp商机分析",
		tables: ["companies", "salesUsers", "opportunities", "whatsappMessages"],
	},

	// 公司-联系人-商机-WhatsApp
	{
		id: "4-6-1",
		text: "分析客户WhatsApp活跃度与商机的关联",
		difficulty: 4,
		category: "活跃度关联",
		description: "活跃度与商机关系",
		tables: ["companies", "contacts", "opportunities", "whatsappMessages"],
	},
	{
		id: "4-6-2",
		text: "找出WhatsApp沟通最能促进商机的客户类型",
		difficulty: 4,
		category: "客户分类",
		description: "优质客户识别",
		tables: ["companies", "contacts", "opportunities", "whatsappMessages"],
	},
	{
		id: "4-6-3",
		text: "统计主联系人WhatsApp参与度对商机成功率的影响",
		difficulty: 4,
		category: "主联系人参与",
		description: "主联系人WhatsApp效应",
		tables: ["companies", "contacts", "opportunities", "whatsappMessages"],
	},
	{
		id: "4-6-4",
		text: "分析不同时区客户的WhatsApp商机沟通最佳时间",
		difficulty: 4,
		category: "时区优化",
		description: "时区WhatsApp商机优化",
		tables: ["companies", "contacts", "opportunities", "whatsappMessages"],
	},

	// 公司-联系人-业务员-WhatsApp
	{
		id: "4-7-1",
		text: "分析业务员与不同客户联系人的WhatsApp沟通效率",
		difficulty: 4,
		category: "沟通效率",
		description: "业务员WhatsApp效率分析",
		tables: ["companies", "contacts", "salesUsers", "whatsappMessages"],
	},
	{
		id: "4-7-2",
		text: "找出最善于通过WhatsApp维护客户关系的业务员",
		difficulty: 4,
		category: "关系维护",
		description: "WhatsApp客户维护专家",
		tables: ["companies", "contacts", "salesUsers", "whatsappMessages"],
	},
	{
		id: "4-7-3",
		text: "统计各部门业务员对不同国家客户的WhatsApp覆盖效果",
		difficulty: 4,
		category: "覆盖效果",
		description: "部门地域WhatsApp覆盖",
		tables: ["companies", "contacts", "salesUsers", "whatsappMessages"],
	},
	{
		id: "4-7-4",
		text: "分析主联系人与业务员的WhatsApp互动对客户忠诚度的影响",
		difficulty: 4,
		category: "忠诚度影响",
		description: "WhatsApp客户忠诚度分析",
		tables: ["companies", "contacts", "salesUsers", "whatsappMessages"],
	},

	// 公司-联系人-业务员-商机
	{
		id: "4-8-1",
		text: "分析业务员、联系人、商机三者的最优配置组合",
		difficulty: 4,
		category: "配置优化",
		description: "三要素最优配置",
		tables: ["companies", "contacts", "salesUsers", "opportunities"],
	},
	{
		id: "4-8-2",
		text: "找出在不同客户类型中商机转化率最高的业务员-联系人组合",
		difficulty: 4,
		category: "转化率优化",
		description: "最佳转化组合识别",
		tables: ["companies", "contacts", "salesUsers", "opportunities"],
	},
	{
		id: "4-8-3",
		text: "统计业务员对不同职位联系人的商机开发成功率",
		difficulty: 4,
		category: "开发成功率",
		description: "职位导向商机开发",
		tables: ["companies", "contacts", "salesUsers", "opportunities"],
	},
	{
		id: "4-8-4",
		text: "分析主联系人更换对现有商机和负责业务员的影响",
		difficulty: 4,
		category: "联系人变更影响",
		description: "主联系人变更商机分析",
		tables: ["companies", "contacts", "salesUsers", "opportunities"],
	},

	// 公司-联系人-跟进-WhatsApp
	{
		id: "4-9-1",
		text: "分析客户联系人的多渠道跟进响应偏好",
		difficulty: 4,
		category: "多渠道偏好",
		description: "跟进渠道偏好分析",
		tables: ["companies", "contacts", "followUps", "whatsappMessages"],
	},
	{
		id: "4-9-2",
		text: "找出WhatsApp与传统跟进结合效果最好的客户群体",
		difficulty: 4,
		category: "结合效果",
		description: "多渠道结合优化",
		tables: ["companies", "contacts", "followUps", "whatsappMessages"],
	},
	{
		id: "4-9-3",
		text: "统计不同国家客户联系人的跟进渠道使用习惯",
		difficulty: 4,
		category: "地域习惯",
		description: "国家跟进渠道偏好",
		tables: ["companies", "contacts", "followUps", "whatsappMessages"],
	},
	{
		id: "4-9-4",
		text: "分析主联系人在WhatsApp和跟进记录中的活跃度一致性",
		difficulty: 4,
		category: "活跃度一致性",
		description: "多渠道活跃度关联",
		tables: ["companies", "contacts", "followUps", "whatsappMessages"],
	},

	// 公司-业务员-跟进-WhatsApp
	{
		id: "4-10-1",
		text: "分析业务员的多渠道客户沟通策略效果",
		difficulty: 4,
		category: "多渠道策略",
		description: "业务员沟通策略分析",
		tables: ["companies", "salesUsers", "followUps", "whatsappMessages"],
	},
	{
		id: "4-10-2",
		text: "找出最善于平衡WhatsApp和传统跟进的业务员",
		difficulty: 4,
		category: "平衡能力",
		description: "多渠道平衡专家",
		tables: ["companies", "salesUsers", "followUps", "whatsappMessages"],
	},
	{
		id: "4-10-3",
		text: "统计各部门业务员的客户沟通渠道偏好差异",
		difficulty: 4,
		category: "部门偏好差异",
		description: "部门沟通偏好分析",
		tables: ["companies", "salesUsers", "followUps", "whatsappMessages"],
	},
	{
		id: "4-10-4",
		text: "分析私海客户在不同沟通渠道下的业务员响应效果",
		difficulty: 4,
		category: "私海沟通效果",
		description: "私海多渠道响应分析",
		tables: ["companies", "salesUsers", "followUps", "whatsappMessages"],
	},

	// 联系人-商机-跟进-WhatsApp
	{
		id: "4-11-1",
		text: "分析联系人在商机推进过程中的多渠道参与模式",
		difficulty: 4,
		category: "参与模式",
		description: "商机多渠道参与分析",
		tables: ["contacts", "opportunities", "followUps", "whatsappMessages"],
	},
	{
		id: "4-11-2",
		text: "找出最能通过多渠道沟通促成高价值商机的联系人特征",
		difficulty: 4,
		category: "高价值特征",
		description: "多渠道高价值联系人",
		tables: ["contacts", "opportunities", "followUps", "whatsappMessages"],
	},
	{
		id: "4-11-3",
		text: "统计不同职位联系人在商机各阶段的沟通渠道选择",
		difficulty: 4,
		category: "阶段渠道选择",
		description: "职位商机阶段沟通",
		tables: ["contacts", "opportunities", "followUps", "whatsappMessages"],
	},
	{
		id: "4-11-4",
		text: "分析商机谈判期间WhatsApp与跟进记录的配合效果",
		difficulty: 4,
		category: "谈判配合",
		description: "商机谈判多渠道配合",
		tables: ["contacts", "opportunities", "followUps", "whatsappMessages"],
	},

	// 业务员-商机-跟进-WhatsApp
	{
		id: "4-12-1",
		text: "分析业务员在商机全生命周期的多渠道沟通策略",
		difficulty: 4,
		category: "全周期策略",
		description: "商机全周期沟通策略",
		tables: ["salesUsers", "opportunities", "followUps", "whatsappMessages"],
	},
	{
		id: "4-12-2",
		text: "找出在高价值商机中最善用多渠道的业务员",
		difficulty: 4,
		category: "高价值多渠道",
		description: "高价值商机沟通专家",
		tables: ["salesUsers", "opportunities", "followUps", "whatsappMessages"],
	},
	{
		id: "4-12-3",
		text: "统计不同商机类型的最优沟通渠道组合和负责业务员",
		difficulty: 4,
		category: "类型渠道组合",
		description: "商机类型沟通优化",
		tables: ["salesUsers", "opportunities", "followUps", "whatsappMessages"],
	},
	{
		id: "4-12-4",
		text: "分析商机从创建到成交过程中的沟通渠道演变模式",
		difficulty: 4,
		category: "渠道演变",
		description: "商机沟通渠道演变",
		tables: ["salesUsers", "opportunities", "followUps", "whatsappMessages"],
	},

	// 公司-关系表-业务员-跟进
	{
		id: "4-13-1",
		text: "分析主负责人与协作者在客户跟进中的分工效果",
		difficulty: 4,
		category: "分工效果",
		description: "团队分工跟进分析",
		tables: ["companies", "companyUserRelations", "salesUsers", "followUps"],
	},
	{
		id: "4-13-2",
		text: "找出团队协作跟进效果最好的客户管理模式",
		difficulty: 4,
		category: "协作模式",
		description: "最佳团队协作模式",
		tables: ["companies", "companyUserRelations", "salesUsers", "followUps"],
	},
	{
		id: "4-13-3",
		text: "统计不同关系类型业务员的客户跟进贡献度",
		difficulty: 4,
		category: "关系贡献度",
		description: "业务员关系角色分析",
		tables: ["companies", "companyUserRelations", "salesUsers", "followUps"],
	},

	// 公司-关系表-业务员-商机
	{
		id: "4-14-1",
		text: "分析主负责人与协作者在商机开发中的配合效果",
		difficulty: 4,
		category: "商机配合",
		description: "团队商机开发分析",
		tables: [
			"companies",
			"companyUserRelations",
			"salesUsers",
			"opportunities",
		],
	},
	{
		id: "4-14-2",
		text: "找出最能产生协同效应的业务员团队组合",
		difficulty: 4,
		category: "协同效应",
		description: "团队协同商机分析",
		tables: [
			"companies",
			"companyUserRelations",
			"salesUsers",
			"opportunities",
		],
	},
	{
		id: "4-14-3",
		text: "统计协作关系对大额商机成功率的影响",
		difficulty: 4,
		category: "协作商机影响",
		description: "协作大额商机分析",
		tables: [
			"companies",
			"companyUserRelations",
			"salesUsers",
			"opportunities",
		],
	},
];
