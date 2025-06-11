import { z } from "zod/v4";

const schema = z.object({
	name: z.string().describe("The name of the user").default("John Doe"),
	age: z.number().describe("The age of the user").default(18),
});

const jsonSchema = z.toJSONSchema(schema);

console.log(jsonSchema);

// {
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   type: "object",
//   properties: {
//     name: {
//       default: "John Doe",
//       description: "The name of the user",
//       type: "string",
//     },
//     age: {
//       default: 18,
//       description: "The age of the user",
//       type: "number",
//     },
//   },
//   required: [ "name", "age" ],
//   additionalProperties: false,
// }
