import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * SQL Error Handler Router - CloudFlare Workflow Error Recovery
 *
 * 职责：分析SQL执行错误并生成修正后的SQL
 * - 分析错误原因
 * - 理解错误上下文
 * - 生成修正后的SQL
 * - 提供修正说明
 */

// 错误处理输入
export const SQLErrorHandlerInputSchema = z.object({
	failedSql: z.string().describe("执行失败的SQL语句"),
	errorMessage: z.string().describe("SQL执行错误信息"),
	naturalLanguageQuery: z.string().optional().describe("原始自然语言查询"),
	selectedSchema: z
		.object({
			tables: z.array(
				z.object({
					name: z.string(),
					columns: z.array(
						z.object({
							name: z.string(),
							type: z.string(),
							nullable: z.boolean().optional(),
						}),
					),
				}),
			),
		})
		.optional()
		.describe("相关的数据库schema信息"),
	queryType: z
		.enum(["SELECT", "AGGREGATE", "COMPLEX"])
		.optional()
		.describe("查询类型"),
	routingStrategy: z
		.enum(["sql_only", "vector_only", "hybrid"])
		.optional()
		.describe("路由策略"),
});

// 错误处理结果
export const SQLErrorHandlerResultSchema = z.object({
	correctedSql: z.string().describe("修正后的SQL语句"),
	errorAnalysis: z.object({
		errorType: z.string().describe("错误类型"),
		rootCause: z.string().describe("根本原因"),
		corrections: z.array(z.string()).describe("具体修正内容"),
	}),
	confidence: z.number().min(0).max(1).describe("修正的置信度"),
});

export type SQLErrorHandlerInput = z.infer<typeof SQLErrorHandlerInputSchema>;
export type SQLErrorHandlerResult = z.infer<typeof SQLErrorHandlerResultSchema>;

// 数据库完整schema信息
const DATABASE_SCHEMA = `
数据库表结构：

1. companies (公司客户表)
   - id: INTEGER PRIMARY KEY
   - companyId: INTEGER UNIQUE NOT NULL (小满CRM系统ID)
   - name: TEXT NOT NULL (公司名称)
   - shortName: TEXT (简称)
   - country: TEXT (国家代码)
   - countryName: TEXT (国家名称)
   - poolName: TEXT (公海/私海池名称)
   - groupName: TEXT (客户分组)
   - trailStatus: TEXT (跟进状态)
   - star: INTEGER (星级)
   - homepage: TEXT (官网)
   - address: TEXT (地址)
   - remark: TEXT (备注)
   - isPrivate: INTEGER (是否私海: 0=公海, 1=私海)
   - createTime: TIMESTAMP
   - updateTime: TIMESTAMP
   - privateTime: TIMESTAMP
   - publicTime: TIMESTAMP

2. contacts (联系人表)
   - id: INTEGER PRIMARY KEY
   - customerId: INTEGER UNIQUE NOT NULL (小满CRM联系人ID)
   - companyId: INTEGER NOT NULL REFERENCES companies(companyId)
   - name: TEXT NOT NULL (联系人姓名)
   - email: TEXT (邮箱)
   - gender: INTEGER (性别: 0=未知, 1=男, 2=女)
   - post: TEXT (职位)
   - whatsapp: TEXT (WhatsApp号码)
   - telAreaCode: TEXT (电话区号)
   - tel: TEXT (电话号码)
   - isMain: INTEGER (是否主联系人)
   - remark: TEXT (备注)

3. salesUsers (业务员表)
   - id: INTEGER PRIMARY KEY
   - userId: TEXT UNIQUE NOT NULL (小满CRM用户ID)
   - nickname: TEXT NOT NULL (昵称)
   - name: TEXT (真实姓名)
   - avatar: TEXT (头像URL)
   - departmentName: TEXT (部门名称)

4. companyUserRelations (客户-业务员关系表)
   - id: INTEGER PRIMARY KEY
   - companyId: INTEGER NOT NULL REFERENCES companies(companyId)
   - userId: TEXT NOT NULL REFERENCES salesUsers(userId)
   - relationType: TEXT (关系类型: owner=负责人, collaborator=协作者)

5. followUps (跟进动态表)
   - id: INTEGER PRIMARY KEY
   - followUpId: INTEGER UNIQUE NOT NULL
   - companyId: INTEGER NOT NULL REFERENCES companies(companyId)
   - customerId: INTEGER REFERENCES contacts(customerId)
   - opportunityId: INTEGER
   - userId: TEXT NOT NULL REFERENCES salesUsers(userId)
   - content: TEXT NOT NULL (跟进内容)
   - type: INTEGER (跟进类型)
   - createTime: TIMESTAMP

6. opportunities (商机表)
   - id: INTEGER PRIMARY KEY
   - opportunityId: INTEGER UNIQUE NOT NULL
   - name: TEXT NOT NULL (商机名称)
   - serialId: TEXT (序列号)
   - companyId: INTEGER NOT NULL REFERENCES companies(companyId)
   - mainUserId: TEXT NOT NULL REFERENCES salesUsers(userId)
   - amount: REAL (金额)
   - currency: TEXT (币种)
   - stageName: TEXT (阶段名称)
   - typeName: TEXT (商机类型)
   - originName: TEXT (来源)
   - remark: TEXT (备注)
   - createTime: TIMESTAMP
   - updateTime: TIMESTAMP
   - orderTime: TIMESTAMP

7. whatsappMessages (WhatsApp消息表)
   - id: INTEGER PRIMARY KEY
   - messageId: TEXT UNIQUE NOT NULL
   - timestamp: INTEGER NOT NULL
   - fromNumber: TEXT NOT NULL
   - toNumber: TEXT NOT NULL
   - body: TEXT (消息内容)
   - fromMe: INTEGER NOT NULL (是否我方发送: 0=收到, 1=发出)
   - contactName: TEXT
   - hasMedia: INTEGER (是否包含媒体文件)
   - ack: INTEGER (消息状态)

注意：
- 所有表名都有 'text2sql_' 前缀
- 时间戳字段使用 INTEGER 存储Unix时间戳
- SQLite不支持布尔类型，使用INTEGER (0/1)代替
`;

export const sqlErrorHandlerRouter = createTRPCRouter({
	handleError: publicProcedure
		.input(SQLErrorHandlerInputSchema)
		.mutation(async ({ input }) => {
			console.log("[SQLErrorHandler] 开始处理SQL错误:", {
				errorMessage: input.errorMessage,
				sqlPreview:
					input.failedSql.substring(0, 100) +
					(input.failedSql.length > 100 ? "..." : ""),
			});

			try {
				// 构建错误分析prompt
				const errorAnalysisPrompt = `你是一个SQL错误分析和修正专家。请分析以下SQL执行错误并生成修正后的SQL。

数据库信息：
${DATABASE_SCHEMA}

失败的SQL语句：
${input.failedSql}

错误信息：
${input.errorMessage}

${input.naturalLanguageQuery ? `原始查询需求：\n${input.naturalLanguageQuery}\n` : ""}

${input.selectedSchema ? `相关表结构：\n${JSON.stringify(input.selectedSchema, null, 2)}\n` : ""}

${input.queryType ? `查询类型：${input.queryType}` : ""}

请分析错误原因并提供修正后的SQL。常见错误类型包括：
1. 表名或列名拼写错误（注意所有表名都有 'text2sql_' 前缀）
2. 缺少表前缀或别名
3. JOIN条件错误或缺失
4. 数据类型不匹配
5. 语法错误（缺少逗号、括号等）
6. 聚合函数使用错误（缺少GROUP BY等）
7. 子查询语法错误
8. 引号使用错误（SQLite使用单引号表示字符串）

请确保：
- 修正后的SQL语法正确
- 使用正确的表名（包含 'text2sql_' 前缀）
- 列名拼写正确
- JOIN条件合理
- 数据类型匹配
- 保持原始查询意图不变`;

				// 使用AI生成修正结果
				const result = await generateObject({
					model: openai("gpt-4.1"),
					system: "你是一个专业的SQL错误分析和修正专家，精通SQLite语法。",
					prompt: errorAnalysisPrompt,
					schema: SQLErrorHandlerResultSchema,
				});

				console.log("[SQLErrorHandler] 错误分析完成:", {
					errorType: result.object.errorAnalysis.errorType,
					confidence: result.object.confidence,
					correctionsCount: result.object.errorAnalysis.corrections.length,
				});

				return {
					success: true,
					result: result.object,
				};
			} catch (error: any) {
				console.error("[SQLErrorHandler] 处理失败:", error);
				throw new Error(`SQL错误处理失败: ${error.message}`);
			}
		}),
});
