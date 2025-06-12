import { z } from "zod/v4";

const schema = z
	.object({
		name: z.string().describe("姓名").default("张三").meta({
			isVectorized: true,
		}),
		age: z.number().describe("年龄").default(18),
	})
	.describe("用户信息的描述字段");

console.log(z.toJSONSchema(schema));

// {
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   description: "用户信息的描述字段",
//   type: "object",
//   properties: {
//     name: {
//       isVectorized: true,
//       default: "张三",
//       description: "姓名",
//       type: "string",
//     },
//     age: {
//       default: 18,
//       description: "年龄",
//       type: "number",
//     },
//   },
//   required: [ "name", "age" ],
//   additionalProperties: false,
// }
