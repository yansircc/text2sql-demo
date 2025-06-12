import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { env } from "../env";

export const embedText = async (text: string) => {
	const openai = createOpenAI({
		apiKey: env.AIHUBMIX_API_KEY,
		baseURL: env.AIHUBMIX_BASE_URL,
	});

	const { embedding } = await embed({
		model: openai.embedding(env.EMBEDDING_MODEL),
		value: text,
	});
	return embedding;
};

export const batchEmbedTexts = async (texts: string[]) => {
	const openai = createOpenAI({
		apiKey: env.AIHUBMIX_API_KEY,
		baseURL: env.AIHUBMIX_BASE_URL,
	});

	const { embeddings } = await embedMany({
		model: openai.embedding(env.EMBEDDING_MODEL),
		values: texts,
	});

	return embeddings;
};
