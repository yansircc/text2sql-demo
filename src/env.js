import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		DATABASE_URL: z.string().url(),
		AIHUBMIX_API_KEY: z.string().min(1, "AIHubMix API key is required"),
		AIHUBMIX_BASE_URL: z.string().url(),
		QDRANT_URL: z.string().url(),
		QDRANT_API_KEY: z.string().min(1, "Qdrant API key is required"),
		QDRANT_DEFAULT_COLLECTION: z
			.string()
			.min(1, "Qdrant default cluster is required"),
		EMBEDDING_DIMENSION: z.preprocess(
			(val) => Number(val),
			z.number().int().min(1, "Embedding dimension is required"),
		),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		// NEXT_PUBLIC_CLIENTVAR: z.string(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		AIHUBMIX_API_KEY: process.env.AIHUBMIX_API_KEY,
		AIHUBMIX_BASE_URL: process.env.AIHUBMIX_BASE_URL,
		QDRANT_URL: process.env.QDRANT_URL,
		QDRANT_API_KEY: process.env.QDRANT_API_KEY,
		QDRANT_DEFAULT_COLLECTION: process.env.QDRANT_DEFAULT_COLLECTION,
		EMBEDDING_DIMENSION: process.env.EMBEDDING_DIMENSION,
		NODE_ENV: process.env.NODE_ENV,
		// NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
