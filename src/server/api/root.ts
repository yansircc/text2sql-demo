import { cacheRouter } from "@/server/api/routers/cache";
import { qdrantRouter } from "@/server/api/routers/qdrant";
import { queryAnalyzerRouter } from "@/server/api/routers/query-analyzer";
import { queryAnalyzerSimplifiedRouter } from "@/server/api/routers/query-analyzer-simplified";
import { resultFusionRouter } from "@/server/api/routers/result-fusion";
import { schemaSelectorRouter } from "@/server/api/routers/schema-selector";
import { schemaSelectorSimplifiedRouter } from "@/server/api/routers/schema-selector-simplified";
import { sqlBuilderRouter } from "@/server/api/routers/sql-builder";
import { sqlBuilderSimplifiedRouter } from "@/server/api/routers/sql-builder-simplified";
import { sqlErrorHandlerRouter } from "@/server/api/routers/sql-error-handler";
import { sqlExecutorRouter } from "@/server/api/routers/sql-executor";
import { vectorSearchRouter } from "@/server/api/routers/vector-search";
import { workflowOrchestratorRouter } from "@/server/api/routers/workflow-orchestrator";
import { workflowOrchestratorOptimizedRouter } from "@/server/api/routers/workflow-orchestrator-optimized";
import { pipelineComparisonRouter } from "@/server/api/routers/pipeline-comparison";
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

	// 简化版模块 (优化AI生成速度)
	queryAnalyzerSimplified: queryAnalyzerSimplifiedRouter,
	schemaSelectorSimplified: schemaSelectorSimplifiedRouter,
	sqlBuilderSimplified: sqlBuilderSimplifiedRouter,

	// 测试与比较
	pipelineComparison: pipelineComparisonRouter,

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
