import { genSQLRouter } from "@/server/api/routers/gen-sql";
import { preHandleRouter } from "@/server/api/routers/pre-handle";
import { preSQLRouter } from "@/server/api/routers/pre-sql";
import { runSQLRouter } from "@/server/api/routers/run-sql";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	preHandle: preHandleRouter,
	preSQL: preSQLRouter,
	genSQL: genSQLRouter,
	runSQL: runSQLRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
