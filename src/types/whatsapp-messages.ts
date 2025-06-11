import { z } from "zod/v4";

// 7. WhatsApp消息表 Schema
export const whatsappMessagesSchema = z
	.object({
		id: z.number().describe("主键ID，自增").optional(),
		messageId: z
			.string()
			.max(200)
			.describe("WhatsApp消息ID，如'msg_001_1'")
			.default(""),
		timestamp: z.number().describe("消息发送时间戳，如1749647057").default(0),
		fromNumber: z
			.string()
			.max(50)
			.describe("发送方号码，如'+8613912345678'")
			.default(""),
		toNumber: z
			.string()
			.max(50)
			.describe("接收方号码，如'+8613987654321'")
			.default(""),
		body: z
			.string()
			.describe("消息内容，如'您好，我是深圳科技创新的刘总监...'")
			.optional(),
		fromMe: z
			.number()
			.min(0)
			.max(1)
			.describe("消息方向：0=客户发给我们，1=我们发给客户")
			.default(0),
		contactName: z
			.string()
			.max(200)
			.describe("联系人显示名称，如'刘总监'")
			.optional(),
		hasMedia: z
			.number()
			.min(0)
			.max(1)
			.describe("是否包含媒体文件：0=纯文本，1=包含图片/文件")
			.default(0),
		ack: z
			.number()
			.describe("消息状态：0=发送中，1=已发送，2=已送达，3=已读")
			.default(2),
		createdAt: z
			.number()
			.describe("数据库记录创建时间戳（自动生成，用于消息排序）")
			.default(() => Math.floor(Date.now() / 1000)),
	})
	.describe(
		"WhatsApp消息表(text2sql_whatsapp_messages) - 存储WhatsApp聊天消息记录，包括消息内容、发送方、接收方、时间等",
	);
