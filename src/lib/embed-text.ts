import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { env } from "../env";

export const embedText = async (text: string) => {
	const openai = createOpenAI({
		apiKey: env.AIHUBMIX_API_KEY,
		baseURL: env.AIHUBMIX_BASE_URL,
	});

	const { embedding } = await embed({
		model: openai.embedding("text-embedding-3-small"),
		value: text,
	});
	return embedding;
};
