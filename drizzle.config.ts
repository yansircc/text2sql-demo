import type { Config } from "drizzle-kit";

import { env } from "@/env";

export default {
	schema: "./src/server/db/schema.ts",
	dialect: "sqlite",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
	out: "./src/server/db/migrations",
	tablesFilter: ["text2sql_*"],
} satisfies Config;
