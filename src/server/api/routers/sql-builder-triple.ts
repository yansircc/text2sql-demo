import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { errorLogger } from "@/lib/simple-error-logger";

/**
 * Triple SQL Builder with Voting Strategy
 * 
 * 3 parallel builders with different strategies:
 * 1. Conservative - Strict matching, high precision
 * 2. Balanced - Mix of approaches
 * 3. Aggressive - Broad matching, high recall
 * 
 * Then 3 AI evaluators vote on the best result
 */

// SQL Build Strategy Types
type BuildStrategy = "conservative" | "balanced" | "aggressive";

interface SqlBuildResult {
  strategy: BuildStrategy;
  sql: string;
  queryType: string;
  executionTime: number;
  model: string;
  // Execution results
  executed?: boolean;
  rowCount?: number;
  results?: any[];
  error?: string;
}

interface VoteResult {
  selectedStrategy: BuildStrategy;
  reason: string;
  confidence: number;
}

// Input schema (reuse from original)
export const SQLBuilderInputSchema = z.object({
  query: z.string(),
  slimSchema: z.record(z.any()),
  selectedTables: z.array(
    z.object({
      tableName: z.string(),
      fields: z.array(z.string()),
      reason: z.string(),
      isJoinTable: z.boolean(),
    }),
  ),
  sqlHints: z.object({
    timeFields: z
      .array(
        z.object({
          table: z.string(),
          field: z.string(),
          dataType: z.enum(["integer", "text", "real"]),
          format: z.enum(["timestamp", "datetime", "date"]),
        }),
      )
      .optional(),
    joinHints: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          on: z.string(),
          type: z.enum(["INNER", "LEFT", "RIGHT"]),
        }),
      )
      .optional(),
    indexedFields: z.array(z.string()).optional(),
    fuzzyPatterns: z.array(z.string()).optional(),
    vectorIds: z.array(z.number()).optional(),
  }),
  timeContext: z
    .object({
      currentTime: z.string(),
      timezone: z.string().default("UTC"),
    })
    .optional(),
});

// Simple SQL result schema for builders
const SimpleSqlResultSchema = z.object({
  sql: z.string(),
  queryType: z.enum(["SELECT", "AGGREGATE", "COMPLEX"]),
});

// Voting schema
const VoteResultSchema = z.object({
  selectedStrategy: z.enum(["conservative", "balanced", "aggressive"]),
  reason: z.string(),
  confidence: z.number().min(0).max(1), // Ensure confidence is between 0-1
});

async function buildSqlWithStrategy(
  input: z.infer<typeof SQLBuilderInputSchema>,
  strategy: BuildStrategy,
  model: any,
  modelName: string
): Promise<SqlBuildResult> {
  const startTime = Date.now();
  
  // Strategy-specific prompts
  let strategyPrompt = "";
  
  switch (strategy) {
    case "conservative":
      strategyPrompt = `
CONSERVATIVE策略要求：
1. 严格使用提供的向量搜索ID进行过滤
2. 优先使用精确匹配而非模糊搜索
3. 谨慎使用JOIN，确保关联正确
4. 限制结果数量，使用较小的LIMIT
5. 当有向量搜索结果时，不要添加额外的文本过滤条件
6. 特别注意比较运算符：>= 表示大于等于，> 表示大于`;
      break;
      
    case "balanced":
      strategyPrompt = `
BALANCED策略要求：
1. 平衡使用向量搜索ID和SQL条件
2. 适度使用模糊搜索补充精确匹配
3. 合理使用JOIN获取完整信息
4. 中等的结果限制
5. 在向量搜索基础上，可以添加少量辅助过滤条件`;
      break;
      
    case "aggressive":
      strategyPrompt = `
AGGRESSIVE策略要求：
1. 扩展搜索范围，不仅限于向量搜索ID
2. 积极使用多种模糊搜索模式
3. 使用LEFT JOIN确保不遗漏数据（只能JOIN提供的schema中存在的表）
4. 较大的结果限制或不限制
5. 即使有向量搜索，也要添加多种文本匹配确保召回率
注意：只能使用提供的schema中的表，不要假设其他表存在`;
      break;
  }
  
  const systemPrompt = `你是SQLite SQL专家，使用${strategy.toUpperCase()}策略生成SQL。

${strategyPrompt}

查询需求: ${input.query}
${input.timeContext ? `当前时间: ${input.timeContext.currentTime}` : ""}

数据库Schema:
${JSON.stringify(input.slimSchema, null, 2)}

使用的表和字段:
${input.selectedTables.map((t) => `- ${t.tableName}: [${t.fields.join(", ")}]`).join("\n")}

${input.sqlHints.vectorIds?.length ? `向量搜索找到的ID: ${input.sqlHints.vectorIds.slice(0, 20).join(", ")}${input.sqlHints.vectorIds.length > 20 ? "..." : ""}` : ""}

生成符合策略的SQL语句。`;
  
  try {
    const { object: result } = await generateObject({
      model,
      system: systemPrompt,
      prompt: "按照指定策略生成SQL",
      schema: SimpleSqlResultSchema,
      temperature: strategy === "conservative" ? 0.1 : strategy === "balanced" ? 0.3 : 0.5,
    });
    
    return {
      strategy,
      sql: result.sql,
      queryType: result.queryType,
      executionTime: Date.now() - startTime,
      model: modelName,
    };
  } catch (error) {
    console.error(`[TripleBuilder] ${strategy} 策略构建失败:`, error);
    throw error;
  }
}

async function executeSql(sql: string): Promise<{ rowCount: number; results: any[]; error?: string }> {
  try {
    console.log(`[TripleBuilder] 执行SQL预览: ${sql.substring(0, 100)}...`);
    const results = await db.all(sql);
    return {
      rowCount: results.length,
      results: results.slice(0, 100), // Limit results for evaluation
    };
  } catch (error) {
    console.error("[TripleBuilder] SQL执行错误:", error);
    return {
      rowCount: 0,
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function voteOnResults(
  query: string,
  results: SqlBuildResult[],
  voterModel: any,
  voterName: string
): Promise<VoteResult> {
  const systemPrompt = `你是SQL结果评估专家。基于用户查询和实际执行结果，选择最佳的SQL策略。

用户查询: ${query}

评估标准:
1. 结果相关性 - 返回的数据是否符合用户需求
2. 结果数量 - 不能太少（遗漏）也不能太多（噪音）
3. 执行成功率 - 是否有错误
4. 查询效率 - 执行时间
5. 数据完整性 - 是否包含用户要求的所有字段

重要规则:
- 如果所有策略都返回0行，选择conservative（最简单可靠）
- 如果策略有错误，不要选择它
- confidence必须在0到1之间（例如0.8表示80%确信度）`;
  
  const resultsInfo = results.map(r => ({
    strategy: r.strategy,
    rowCount: r.rowCount || 0,
    hasError: !!r.error,
    errorMessage: r.error,
    executionTime: r.executionTime,
    sampleData: r.results?.slice(0, 3),
  }));
  
  const { object: vote } = await generateObject({
    model: voterModel,
    system: systemPrompt,
    prompt: `评估这些SQL执行结果:\n${JSON.stringify(resultsInfo, null, 2)}`,
    schema: VoteResultSchema,
    temperature: 0.2,
  });
  
  return vote;
}

export const sqlBuilderTripleRouter = createTRPCRouter({
  buildWithVoting: publicProcedure
    .input(SQLBuilderInputSchema)
    .mutation(async ({ input }) => {
      const startTime = Date.now();
      const queryId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      console.log("[TripleBuilder] 开始3+3策略SQL构建");
      
      try {
        // Initialize models
        const anthropic = createAnthropic({
          apiKey: env.AIHUBMIX_API_KEY,
          baseURL: env.AIHUBMIX_BASE_URL,
        });
        
        const openai = createOpenAI({
          apiKey: env.AIHUBMIX_API_KEY,
          baseURL: env.AIHUBMIX_BASE_URL,
        });
        
        // Step 1: 3 parallel SQL builds with different strategies
        console.log("[TripleBuilder] Step 1: 并行构建3个SQL");
        const buildPromises = [
          buildSqlWithStrategy(input, "conservative", openai("gpt-4o-mini"), "gpt-4o-mini"),
          buildSqlWithStrategy(input, "balanced", openai("gpt-4.1"), "gpt-4.1"),
          buildSqlWithStrategy(input, "aggressive", anthropic("claude-3-sonnet-20240229"), "claude-3-sonnet"),
        ];
        
        const buildResults = await Promise.all(buildPromises);
        console.log("[TripleBuilder] 3个SQL构建完成");
        
        // Log generated SQLs for debugging
        buildResults.forEach(result => {
          console.log(`[TripleBuilder] ${result.strategy} SQL:`, result.sql.substring(0, 200) + "...");
        });
        
        // Step 2: Execute all SQLs to get actual results
        console.log("[TripleBuilder] Step 2: 执行所有SQL获取结果");
        const executePromises = buildResults.map(async (result) => {
          const execResult = await executeSql(result.sql);
          return {
            ...result,
            executed: true,
            rowCount: execResult.rowCount,
            results: execResult.results,
            error: execResult.error,
          };
        });
        
        const executedResults = await Promise.all(executePromises);
        console.log("[TripleBuilder] SQL执行完成:", {
          conservative: { rowCount: executedResults[0].rowCount, hasError: !!executedResults[0].error },
          balanced: { rowCount: executedResults[1].rowCount, hasError: !!executedResults[1].error },
          aggressive: { rowCount: executedResults[2].rowCount, hasError: !!executedResults[2].error },
        });
        
        // Step 3: 3 AI voters evaluate results
        console.log("[TripleBuilder] Step 3: 3个AI评估者投票");
        const votePromises = [
          voteOnResults(input.query, executedResults, openai("gpt-4.1"), "gpt-4.1"),
          voteOnResults(input.query, executedResults, anthropic("claude-3-sonnet-20240229"), "claude-3-sonnet"),
          voteOnResults(input.query, executedResults, anthropic("claude-3-opus-20240229"), "claude-3-opus"),
        ];
        
        const votes = await Promise.all(votePromises);
        console.log("[TripleBuilder] 投票结果:", votes.map(v => ({
          selected: v.selectedStrategy,
          confidence: v.confidence,
        })));
        
        // Step 4: Tally votes and select winner
        const voteCounts = {
          conservative: 0,
          balanced: 0,
          aggressive: 0,
        };
        
        let totalConfidence = 0;
        votes.forEach(vote => {
          voteCounts[vote.selectedStrategy]++;
          totalConfidence += vote.confidence;
        });
        
        // Find winner (most votes, or highest confidence if tied)
        let winner: BuildStrategy = "balanced"; // default
        let maxVotes = 0;
        
        for (const [strategy, count] of Object.entries(voteCounts)) {
          if (count > maxVotes) {
            maxVotes = count;
            winner = strategy as BuildStrategy;
          }
        }
        
        // Get the winning result
        let winningResult = executedResults.find(r => r.strategy === winner)!;
        
        // If the winning result has 0 rows or error, try to find a better alternative
        if (winningResult.rowCount === 0 || winningResult.error) {
          // Find any result that has rows and no error
          const betterResult = executedResults.find(r => r.rowCount! > 0 && !r.error);
          if (betterResult) {
            winningResult = betterResult;
            winner = betterResult.strategy;
            console.log("[TripleBuilder] 覆盖投票结果，选择有数据的策略:", winner);
          } else {
            // If all strategies failed, log warning
            console.warn("[TripleBuilder] 警告：所有策略都返回0行或有错误");
            
            // Try to use the strategy without error at least
            const noErrorResult = executedResults.find(r => !r.error);
            if (noErrorResult) {
              winningResult = noErrorResult;
              winner = noErrorResult.strategy;
            }
          }
        }
        
        console.log("[TripleBuilder] 最终选择:", {
          winner,
          votes: voteCounts,
          avgConfidence: totalConfidence / votes.length,
          rowCount: winningResult.rowCount,
          totalTime: Date.now() - startTime,
        });
        
        return {
          success: true,
          result: {
            sql: winningResult.sql,
            queryType: winningResult.queryType,
            estimatedRows: winningResult.rowCount! > 50 ? "many" : winningResult.rowCount! > 10 ? "moderate" : "few",
            usesIndex: true,
            warnings: winningResult.error ? [winningResult.error] : undefined,
            explanation: `使用${winner}策略，获得${votes.filter(v => v.selectedStrategy === winner).length}票支持`,
          },
          executionTime: Date.now() - startTime,
          strategy: winner,
          voting: {
            votes: voteCounts,
            avgConfidence: totalConfidence / votes.length,
            allResults: executedResults.map(r => ({
              strategy: r.strategy,
              rowCount: r.rowCount || 0,
              hasError: !!r.error,
            })),
          },
        };
        
      } catch (error) {
        console.error("[TripleBuilder] 严重错误:", error);
        errorLogger.logError(
          queryId,
          input.query,
          "triple_sql_builder",
          error,
          {
            tables: input.selectedTables.map(t => t.tableName),
          }
        );
        throw new Error("Triple SQL构建失败");
      }
    }),
});