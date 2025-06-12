import type { QueryTask } from "../constants";

/**
 * 无效查询
 * 这些查询与CRM数据库完全无关，应该被系统识别为不可行并拒绝
 * 用于测试系统的错误处理能力
 */
export const nonsense: QueryTask[] = [
	{
		id: "nonsense-1",
		text: "今天北京的天气怎么样？",
		difficulty: 1,
		category: "无效查询",
		description: "天气信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-2",
		text: "苹果公司的股票价格是多少？",
		difficulty: 1,
		category: "无效查询",
		description: "股票价格信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-3",
		text: "如何做番茄炒蛋？",
		difficulty: 1,
		category: "无效查询",
		description: "食谱信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-4",
		text: "2024年世界杯冠军是谁？",
		difficulty: 1,
		category: "无效查询",
		description: "体育赛事信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-5",
		text: "最新的iPhone型号有什么特点？",
		difficulty: 1,
		category: "无效查询",
		description: "产品评测信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-6",
		text: "Python和Java哪个编程语言更好？",
		difficulty: 1,
		category: "无效查询",
		description: "编程语言比较不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-7",
		text: "希望小学的成立时间是什么时候？",
		difficulty: 1,
		category: "无效查询",
		description: "教育机构历史信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-8",
		text: "如何治疗感冒？",
		difficulty: 1,
		category: "无效查询",
		description: "医疗健康信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-9",
		text: "地球到月球的距离是多少？",
		difficulty: 1,
		category: "无效查询",
		description: "天文科学信息不在CRM数据库范围内",
		tables: [],
	},
	{
		id: "nonsense-10",
		text: "最近有什么好看的电影推荐？",
		difficulty: 1,
		category: "无效查询",
		description: "娱乐推荐信息不在CRM数据库范围内",
		tables: [],
	},
];
