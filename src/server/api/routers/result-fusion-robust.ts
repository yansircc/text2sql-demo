import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Robust Result Fusion Router
 * 
 * 更鲁棒的融合策略：
 * 1. AI只负责排序和评分
 * 2. 系统保留所有原始数据
 * 3. 避免字段选择错误
 */

// 融合输入
export const ResultFusionInputSchema = z.object({
	userQuery: z.string(),
	vectorResults: z.array(z.any()).optional(),
	sqlResults: z.array(z.any()).optional(),
	maxResults: z.number().default(50),
});

// AI只做排序和评分，不选择字段
const AIRankingSchema = z.object({
	// 向量结果排序
	vectorRankings: z.array(z.object({
		index: z.number(),
		relevanceScore: z.number().min(0).max(1),
		reason: z.string(),
	})).default([]),
	
	// SQL结果排序
	sqlRankings: z.array(z.object({
		index: z.number(),
		relevanceScore: z.number().min(0).max(1),
		reason: z.string(),
	})).default([]),
	
	// 整体策略
	fusionStrategy: z.enum([
		"prefer_sql",      // SQL结果更相关
		"prefer_vector",   // 向量结果更相关
		"balanced",        // 两者都重要
		"sql_only",        // 只用SQL
		"vector_only"      // 只用向量
	]).default("balanced"),
	
	// 解释
	explanation: z.string(),
});

function executeRobustMerge(
	vectorResults: any[],
	sqlResults: any[],
	ranking: z.infer<typeof AIRankingSchema>,
	maxResults: number
): any[] {
	const results: any[] = [];
	const usedIds = new Set<any>();
	
	// 根据策略决定如何合并
	switch (ranking.fusionStrategy) {
		case "sql_only":
			// 只使用SQL结果，按AI排序
			ranking.sqlRankings
				.sort((a, b) => b.relevanceScore - a.relevanceScore)
				.forEach(rank => {
					if (sqlResults[rank.index] && results.length < maxResults) {
						results.push({
							...sqlResults[rank.index],
							_source: "sql",
							_relevance: rank.relevanceScore,
							_reason: rank.reason
						});
					}
				});
			break;
			
		case "vector_only":
			// 只使用向量结果，按AI排序
			ranking.vectorRankings
				.sort((a, b) => b.relevanceScore - a.relevanceScore)
				.forEach(rank => {
					if (vectorResults[rank.index] && results.length < maxResults) {
						results.push({
							...vectorResults[rank.index],
							_source: "vector",
							_relevance: rank.relevanceScore,
							_reason: rank.reason
						});
					}
				});
			break;
			
		case "prefer_sql":
			// SQL优先，但也包含高分向量结果
			const sqlFirst = ranking.sqlRankings
				.sort((a, b) => b.relevanceScore - a.relevanceScore);
			const vectorSecond = ranking.vectorRankings
				.sort((a, b) => b.relevanceScore - a.relevanceScore)
				.filter(v => v.relevanceScore > 0.7); // 只包含高相关度的向量结果
			
			// 先添加SQL结果
			sqlFirst.forEach(rank => {
				if (sqlResults[rank.index] && results.length < maxResults) {
					const record = sqlResults[rank.index];
					results.push({
						...record,
						_source: "sql",
						_relevance: rank.relevanceScore,
						_reason: rank.reason
					});
					// 记录ID防止重复
					if (record.id || record.companyId) {
						usedIds.add(record.id || record.companyId);
					}
				}
			});
			
			// 补充向量结果
			vectorSecond.forEach(rank => {
				if (vectorResults[rank.index] && results.length < maxResults) {
					const record = vectorResults[rank.index];
					const id = record.id || record.companyId;
					// 避免重复
					if (!id || !usedIds.has(id)) {
						results.push({
							...record,
							_source: "vector",
							_relevance: rank.relevanceScore,
							_reason: rank.reason
						});
					}
				}
			});
			break;
			
		case "prefer_vector":
			// 向量优先，但也包含高分SQL结果
			const vectorFirst = ranking.vectorRankings
				.sort((a, b) => b.relevanceScore - a.relevanceScore);
			const sqlSecond = ranking.sqlRankings
				.sort((a, b) => b.relevanceScore - a.relevanceScore)
				.filter(s => s.relevanceScore > 0.7);
			
			// 先添加向量结果
			vectorFirst.forEach(rank => {
				if (vectorResults[rank.index] && results.length < maxResults) {
					const record = vectorResults[rank.index];
					results.push({
						...record,
						_source: "vector",
						_relevance: rank.relevanceScore,
						_reason: rank.reason
					});
					if (record.id || record.companyId) {
						usedIds.add(record.id || record.companyId);
					}
				}
			});
			
			// 补充SQL结果
			sqlSecond.forEach(rank => {
				if (sqlResults[rank.index] && results.length < maxResults) {
					const record = sqlResults[rank.index];
					const id = record.id || record.companyId;
					if (!id || !usedIds.has(id)) {
						results.push({
							...record,
							_source: "sql",
							_relevance: rank.relevanceScore,
							_reason: rank.reason
						});
					}
				}
			});
			break;
			
		case "balanced":
		default:
			// 平衡策略：交替添加高分结果
			const allRankings: Array<{source: 'vector' | 'sql', ranking: any, data: any}> = [
				...ranking.vectorRankings.map(r => ({
					source: 'vector' as const,
					ranking: r,
					data: vectorResults[r.index]
				})),
				...ranking.sqlRankings.map(r => ({
					source: 'sql' as const,
					ranking: r,
					data: sqlResults[r.index]
				}))
			];
			
			// 按相关度排序
			allRankings.sort((a, b) => b.ranking.relevanceScore - a.ranking.relevanceScore);
			
			// 添加结果，避免重复
			allRankings.forEach(item => {
				if (item.data && results.length < maxResults) {
					const id = item.data.id || item.data.companyId;
					if (!id || !usedIds.has(id)) {
						results.push({
							...item.data,
							_source: item.source,
							_relevance: item.ranking.relevanceScore,
							_reason: item.ranking.reason
						});
						if (id) usedIds.add(id);
					}
				}
			});
			break;
	}
	
	return results;
}

export const resultFusionRobustRouter = createTRPCRouter({
	fuse: publicProcedure
		.input(ResultFusionInputSchema)
		.mutation(async ({ input }) => {
			try {
				const startTime = Date.now();
				
				console.log("[RobustFusion] 开始鲁棒融合:", {
					query: input.userQuery.substring(0, 50) + "...",
					vectorCount: input.vectorResults?.length || 0,
					sqlCount: input.sqlResults?.length || 0,
				});
				
				// 如果只有一种结果，直接返回
				if (!input.vectorResults?.length && input.sqlResults?.length) {
					console.log("[RobustFusion] 只有SQL结果，直接返回");
					return {
						success: true,
						results: input.sqlResults.slice(0, input.maxResults),
						count: input.sqlResults.length,
						metadata: {
							strategy: "sql_only",
							explanation: "只有SQL查询结果",
						}
					};
				}
				
				if (input.vectorResults?.length && !input.sqlResults?.length) {
					console.log("[RobustFusion] 只有向量结果，直接返回");
					return {
						success: true,
						results: input.vectorResults.slice(0, input.maxResults),
						count: input.vectorResults.length,
						metadata: {
							strategy: "vector_only",
							explanation: "只有向量搜索结果",
						}
					};
				}
				
				// 准备数据摘要
				const vectorSummary = input.vectorResults?.slice(0, 5).map((r, idx) => ({
					index: idx,
					preview: JSON.stringify(r).substring(0, 200) + "..."
				}));
				
				const sqlSummary = input.sqlResults?.slice(0, 5).map((r, idx) => ({
					index: idx,
					preview: JSON.stringify(r).substring(0, 200) + "..."
				}));
				
				const openai = createOpenAI({
					apiKey: env.AIHUBMIX_API_KEY,
					baseURL: env.AIHUBMIX_BASE_URL,
				});
				
				const systemPrompt = `你是数据相关性评分专家。基于用户查询，对每条记录的相关性进行评分。

用户查询: ${input.userQuery}

向量搜索结果预览:
${JSON.stringify(vectorSummary, null, 2)}

SQL查询结果预览:
${JSON.stringify(sqlSummary, null, 2)}

任务：
1. 为每条记录评分（0-1分），基于与用户查询的相关性
2. 简短说明评分原因
3. 选择合适的融合策略

注意：
- 不要修改数据，只评分和排序
- 考虑数据的完整性和相关性
- 如果某个数据源明显更相关，选择对应的策略`;
				
				const { object: ranking } = await generateObject({
					model: openai("gpt-4o-mini"),
					system: systemPrompt,
					prompt: "对结果进行相关性评分和排序",
					schema: AIRankingSchema,
					temperature: 0.2,
				});
				
				console.log("[RobustFusion] AI评分完成:", {
					strategy: ranking.fusionStrategy,
					vectorRankings: ranking.vectorRankings.length,
					sqlRankings: ranking.sqlRankings.length,
				});
				
				// 执行融合
				const mergedResults = executeRobustMerge(
					input.vectorResults || [],
					input.sqlResults || [],
					ranking,
					input.maxResults
				);
				
				console.log("[RobustFusion] 融合完成:", {
					resultCount: mergedResults.length,
					executionTime: Date.now() - startTime,
				});
				
				return {
					success: true,
					results: mergedResults,
					count: mergedResults.length,
					metadata: {
						strategy: ranking.fusionStrategy,
						explanation: ranking.explanation,
					}
				};
				
			} catch (error) {
				console.error("[RobustFusion] 融合失败:", error);
				
				// 终极降级：合并所有结果
				const allResults = [
					...(input.sqlResults || []).map(r => ({ ...r, _source: "sql" })),
					...(input.vectorResults || []).map(r => ({ ...r, _source: "vector" }))
				];
				
				return {
					success: true,
					results: allResults.slice(0, input.maxResults),
					count: allResults.length,
					metadata: {
						strategy: "fallback",
						explanation: "AI评分失败，返回所有结果",
					}
				};
			}
		}),
});