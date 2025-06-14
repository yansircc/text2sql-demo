import { cacheRouter } from "@/server/api/routers/cache";
import { qdrantRouter } from "@/server/api/routers/qdrant";
import { queryAnalyzerRouter } from "@/server/api/routers/query-analyzer";
import { resultFusionRouter } from "@/server/api/routers/result-fusion";
import { schemaSelectorRouter } from "@/server/api/routers/schema-selector";
import { sqlBuilderRouter } from "@/server/api/routers/sql-builder";
import { sqlErrorHandlerRouter } from "@/server/api/routers/sql-error-handler";
import { sqlExecutorRouter } from "@/server/api/routers/sql-executor";
import { vectorSearchRouter } from "@/server/api/routers/vector-search";
import { workflowOrchestratorRouter } from "@/server/api/routers/workflow-orchestrator";
import { workflowOrchestratorOptimizedRouter } from "@/server/api/routers/workflow-orchestrator-optimized";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * 主路由器 - 新版模块化架构
 * 适合部署到 CloudFlare Workflow
 */
export const appRouter = createTRPCRouter({
	// 核心模块
	queryAnalyzer: queryAnalyzerRouter,
	vectorSearch: vectorSearchRouter,
	schemaSelector: schemaSelectorRouter,
	sqlBuilder: sqlBuilderRouter,
	sqlExecutor: sqlExecutorRouter,
	sqlErrorHandler: sqlErrorHandlerRouter,
	resultFusion: resultFusionRouter,
	workflow: workflowOrchestratorRouter,
	workflowOptimized: workflowOrchestratorOptimizedRouter,

	// 辅助功能
	cache: cacheRouter,
	qdrant: qdrantRouter,
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
