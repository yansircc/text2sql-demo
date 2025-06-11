import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const openai = createOpenAI({
	apiKey: process.env.AIHUBMIX_API_KEY,
	baseURL: process.env.AIHUBMIX_BASE_URL,
});

const schema = z.object({
	name: z.string().describe("The name of the user").default("John Doe"),
	age: z.number().describe("The age of the user").default(18),
});

const { object } = await generateObject({
	model: openai("gpt-4o-mini"),
	prompt: "Generate a user object",
	schema,
});

console.log(object);
// {
//   name: "John Doe",
//   age: 18,
// }
