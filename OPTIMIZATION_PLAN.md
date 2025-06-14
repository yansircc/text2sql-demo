# Performance Optimization Implementation Plan

## 🎯 Goals
1. Reduce query latency by 50-70%
2. Implement smart caching with toggle control
3. Optimize schema handling to reduce parsing overhead
4. Enable parallel processing for hybrid queries
5. Batch vector operations for efficiency

## 📋 Implementation Checklist

### Phase 1: Schema Optimization (Critical for AI Context)
- [ ] Analyze schema requirements for each component:
  - **Query Analyzer**: Needs table names, descriptions, and key relationships only
  - **Schema Selector**: Needs filtered schema with relationships intact
  - **SQL Builder**: Needs detailed schema of selected tables only
  - **SQL Error Handler**: Needs full schema for comprehensive error fixing
- [ ] Create schema utility functions:
  - `getMinimalSchema()`: Table names and descriptions only
  - `getFilteredSchema()`: Specific tables with relationships
  - `getDetailedSchema()`: Full column details for selected tables
- [ ] Update each router to use appropriate schema level

### Phase 2: Caching System
- [ ] Implement cache infrastructure:
  - LRU cache for in-memory storage
  - Redis adapter for production (future)
  - Cache key generation strategy
- [ ] Add caching layers:
  - Query analysis results
  - Vector embeddings
  - Schema selections
  - SQL generation patterns
- [ ] Implement cache controls:
  - Environment toggle (`ENABLE_QUERY_CACHE`)
  - TTL configuration
  - Cache warming strategies
- [ ] Add cache management routes:
  - `POST /api/cache/clear` - Clear all caches
  - `POST /api/cache/clear/:type` - Clear specific cache type
  - `GET /api/cache/stats` - Cache statistics

### Phase 3: Parallel Operations
- [ ] Refactor hybrid workflow:
  - Identify independent operations
  - Implement Promise.all() for parallel execution
  - Handle partial failures gracefully
- [ ] Parallel operations to implement:
  - Vector search + Schema preparation
  - Multiple vector searches across tables
  - Batch embedding generation

### Phase 4: Vector Batching
- [ ] Batch embedding generation:
  - Group multiple texts for single API call
  - Implement request queuing
  - Handle batch size limits
- [ ] Batch Qdrant operations:
  - Group searches by collection
  - Implement batch upserts
  - Optimize filter conditions

### Phase 5: Testing & Monitoring
- [ ] Add performance benchmarks
- [ ] Implement performance tracking
- [ ] Create load testing scenarios
- [ ] Document performance improvements

## 🏗️ Architecture Decisions

### Schema Handling Strategy
```typescript
// Current: Full schema passed everywhere
fullSchema → QueryAnalyzer → SchemaSelector → SQLBuilder

// Optimized: Progressive schema refinement
minimalSchema → QueryAnalyzer
     ↓
filteredSchema → SchemaSelector
     ↓
selectedSchema → SQLBuilder
     ↓
fullSchema → SQLErrorHandler (only on error)
```

### Caching Architecture
```typescript
interface CacheConfig {
  enabled: boolean;          // From env.ENABLE_QUERY_CACHE
  ttl: {
    embeddings: 3600,       // 1 hour
    queryAnalysis: 900,     // 15 minutes
    schemaSelection: 1800,  // 30 minutes
    sqlGeneration: 600,     // 10 minutes
  };
  maxSize: {
    embeddings: 10000,
    queryAnalysis: 1000,
    schemaSelection: 500,
    sqlGeneration: 500,
  };
}
```

### Parallel Execution Flow
```
Before (Sequential - ~4000ms):
QueryAnalysis → VectorSearch → SchemaSelection → SQLBuilding → SQLExecution → ResultFusion

After (Parallel - ~2000ms):
QueryAnalysis → [VectorSearch + SchemaPrep] → [SchemaSelection + SQLBuilding] → SQLExecution → ResultFusion
                 └── Parallel ──┘                └── Can overlap ──┘
```

## 📊 Expected Performance Gains

| Operation | Current | Target | Method |
|-----------|---------|--------|--------|
| Schema Parsing | 200-300ms | 20-50ms | Progressive refinement |
| Vector Search | 1500ms | 500ms | Caching + Batching |
| Hybrid Query | 4000ms | 1500ms | Parallelization |
| Cache Hits | 0% | 60-80% | Smart caching |

## 🚀 Implementation Order

1. **Day 1-2**: Schema optimization (biggest impact on AI quality)
2. **Day 3-4**: Caching system with management routes
3. **Day 5**: Parallel operations in hybrid mode
4. **Day 6**: Vector batching
5. **Day 7**: Testing and fine-tuning

## ⚠️ Risk Mitigation

1. **Cache Invalidation**
   - Manual clear routes for fixing AI mistakes
   - TTL to prevent stale data
   - Version-based cache keys

2. **Schema Context Loss**
   - Carefully test each component with reduced schema
   - Keep fallback to full schema if needed
   - Monitor AI response quality

3. **Parallel Operation Failures**
   - Implement circuit breakers
   - Graceful degradation to sequential
   - Proper error aggregation