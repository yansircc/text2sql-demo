# Implementation Checklist for Performance Optimizations

## 1. Schema Optimization Checklist

### 1.1 Update Query Analyzer ✅
- [ ] Import schema-utils in `query-analyzer.ts`
- [ ] Replace full schema with minimal schema:
  ```typescript
  const minimalSchema = getMinimalSchema(input.databaseSchema);
  const prompt = `Analyze query with tables: ${JSON.stringify(minimalSchema)}`;
  ```
- [ ] Test query analysis still identifies correct tables

### 1.2 Update Schema Selector ✅
- [ ] Import schema-utils in `schema-selector.ts`
- [ ] Use filtered schema instead of full:
  ```typescript
  const filteredSchema = getFilteredSchema(
    input.fullSchema, 
    input.sqlConfig.tables
  );
  ```
- [ ] Ensure relationships are preserved for JOIN operations

### 1.3 Update SQL Builder ✅
- [ ] Import schema-utils in `sql-builder.ts`
- [ ] Use detailed schema for selected tables only:
  ```typescript
  const detailedSchema = getDetailedSchema(
    fullSchema,
    input.selectedTables.map(t => t.name)
  );
  ```

### 1.4 Update Workflow Orchestrator ✅
- [ ] Parse schema once at the beginning
- [ ] Pass appropriate schema level to each component
- [ ] Remove redundant schema parsing

## 2. Caching Implementation Checklist

### 2.1 Create Cache Infrastructure ✅
- [ ] Install LRU cache: `bun add lru-cache`
- [ ] Create `cache-manager.ts`:
  ```typescript
  export class CacheManager {
    private queryCache: LRUCache<string, any>;
    private embeddingCache: LRUCache<string, number[]>;
    private schemaCache: LRUCache<string, any>;
    
    constructor(enabled: boolean) {
      if (!enabled) return;
      // Initialize caches
    }
  }
  ```

### 2.2 Add Cache to Each Router ✅
- [ ] Query Analyzer:
  - Cache key: hash(query + strategy)
  - TTL: 15 minutes
- [ ] Vector Search:
  - Cache embeddings by text
  - TTL: 1 hour
- [ ] Schema Selector:
  - Cache by table combination
  - TTL: 30 minutes
- [ ] SQL Builder:
  - Cache common patterns
  - TTL: 10 minutes

### 2.3 Create Cache Management Routes ✅
- [ ] Create `cache-router.ts`:
  ```typescript
  export const cacheRouter = createTRPCRouter({
    clearAll: publicProcedure.mutation(/* ... */),
    clearType: publicProcedure.input(z.object({
      type: z.enum(['query', 'embedding', 'schema', 'sql'])
    })).mutation(/* ... */),
    stats: publicProcedure.query(/* ... */)
  });
  ```
- [ ] Add to main router in `root.ts`

## 3. Parallel Operations Checklist

### 3.1 Identify Parallelizable Operations ✅
- [ ] In hybrid mode:
  - Vector search
  - Schema preparation
  - Initial data fetching
- [ ] Across multiple tables:
  - Batch vector searches
  - Parallel embedding generation

### 3.2 Refactor Workflow Orchestrator ✅
- [ ] Replace sequential calls with Promise.all():
  ```typescript
  if (strategy === "hybrid") {
    const [vectorResult, schemaPrep] = await Promise.all([
      api.vectorSearch.search(vectorConfig),
      prepareSchemaData(fullSchema, sqlConfig)
    ]);
  }
  ```
- [ ] Handle partial failures gracefully
- [ ] Track timing for parallel operations

### 3.3 Update Step Tracking ✅
- [ ] Record parallel execution times
- [ ] Show which operations ran in parallel
- [ ] Calculate time savings

## 4. Vector Batching Checklist

### 4.1 Batch Embedding Generation ✅
- [ ] Update embedding generator:
  ```typescript
  async function batchGenerateEmbeddings(
    texts: string[], 
    options?: { maxBatchSize?: number }
  ): Promise<number[][]>
  ```
- [ ] Handle API rate limits
- [ ] Implement request queuing

### 4.2 Batch Qdrant Operations ✅
- [ ] Group searches by collection
- [ ] Combine filters for efficiency
- [ ] Implement batch upsert for vector updates

### 4.3 Update Vector Search Router ✅
- [ ] Accept multiple queries
- [ ] Process in batches
- [ ] Return aggregated results

## 5. Testing & Validation Checklist

### 5.1 Performance Benchmarks ✅
- [ ] Create benchmark script:
  ```typescript
  // benchmark.ts
  const queries = [
    "Find all companies in USA",
    "Show recent opportunities",
    "Search sustainable energy companies"
  ];
  
  for (const query of queries) {
    const start = Date.now();
    await runQuery(query);
    console.log(`Query took: ${Date.now() - start}ms`);
  }
  ```

### 5.2 Cache Effectiveness ✅
- [ ] Measure cache hit rates
- [ ] Compare performance with/without cache
- [ ] Validate cache invalidation

### 5.3 Quality Assurance ✅
- [ ] Ensure AI responses remain accurate with minimal schema
- [ ] Test edge cases (cache misses, parallel failures)
- [ ] Verify result consistency

## 6. Environment & Configuration Checklist

### 6.1 Environment Variables ✅
- [ ] Add to `.env.local`:
  ```
  ENABLE_QUERY_CACHE=true
  CACHE_REDIS_URL=redis://localhost:6379  # For future
  ```
- [ ] Update env validation in `env.js` ✅ (Already done)

### 6.2 Configuration Options ✅
- [ ] Create config file:
  ```typescript
  export const performanceConfig = {
    cache: {
      enabled: env.ENABLE_QUERY_CACHE,
      ttl: { /* ... */ },
      maxSize: { /* ... */ }
    },
    parallel: {
      maxConcurrent: 5,
      timeout: 5000
    },
    batching: {
      embeddings: { maxSize: 10 },
      qdrant: { maxSize: 50 }
    }
  };
  ```

## 7. Documentation Checklist

### 7.1 Update CLAUDE.md ✅
- [ ] Add cache management commands
- [ ] Document performance features
- [ ] Include troubleshooting guide

### 7.2 API Documentation ✅
- [ ] Document cache routes
- [ ] Explain parallelization behavior
- [ ] Add performance tuning guide

## 🎯 Success Metrics

- [ ] Query latency reduced by 50%+
- [ ] Cache hit rate > 60%
- [ ] Zero regression in result quality
- [ ] All tests passing
- [ ] Performance monitoring in place

## 🚦 Go/No-Go Criteria

Before deploying:
1. All unit tests pass
2. Benchmark shows 40%+ improvement
3. Cache can be disabled without breaking
4. No AI quality degradation
5. Error handling tested