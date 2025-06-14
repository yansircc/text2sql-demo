# AI Context & Structured Output Optimization Strategy

## Core Principle
**Optimize data flow without sacrificing AI precision by preserving essential context and simplifying structured outputs.**

## Step-by-Step Analysis

### 1. Query Analyzer (query-analyzer.ts)

#### Current AI Context Needs:
- **Full database schema**: CRITICAL - AI needs to understand table relationships
- **Vectorized fields mapping**: CRITICAL - AI needs to know which fields have semantic search
- **User query**: CRITICAL - Core input for analysis

#### Current Structured Output (QueryAnalysisSchema):
```typescript
// Current: 17 fields across nested objects
{
  queryId, originalQuery, timestamp,
  feasibility: { isFeasible, reason, suggestedAlternatives },
  clarity: { isClear, missingInfo[] },
  routing: { strategy, reason, confidence },
  sqlConfig?: { tables[], canUseFuzzySearch, fuzzyPatterns[], estimatedComplexity },
  vectorConfig?: { queries[], requiresReranking },
  hybridConfig?: { description }
}
```

#### Simplified Output Proposal:
```typescript
// Simplified: 8 essential fields
{
  routing: { strategy, confidence },  // Core decision
  sqlTables?: string[],              // Just table names
  vectorQueries?: Array<{            // Minimal vector config
    table: string,
    field: string,
    query: string
  }>,
  feasible: boolean,                 // Simple boolean
  reason?: string                    // Combined explanation
}
```

**Reduction: 53% fewer fields, 70% simpler structure**

### 2. Schema Selector (schema-selector.ts)

#### Current AI Context Needs:
- **User query**: CRITICAL - Understanding intent
- **SQL config from analyzer**: CRITICAL - Pre-selected tables
- **Schema for selected tables**: CRITICAL - But only selected tables, not full DB
- **Vector context**: OPTIONAL - Only for hybrid mode

#### Optimization:
```typescript
// Before: Pass full filtered schema as JSON string
fullSchema: JSON.stringify(filteredSchema) // 50-200KB

// After: Pass only what AI needs
schemaContext: {
  tables: ['companies', 'contacts'],  // Just names
  totalFields: 45,                    // Summary stats
  keyRelations: [                     // Only critical joins
    { from: 'companies.id', to: 'contacts.companyId' }
  ]
}
```

#### Simplified Output:
```typescript
// Current: Complex nested structure
{
  selectedTables: [{ tableName, fields[], reason, isJoinTable }],
  slimSchema: {},
  compressionRatio: number,
  sqlHints: { timeFields[], joinHints[], indexedFields[] }
}

// Simplified: Flat structure
{
  tables: string[],           // ['companies', 'contacts']
  fields: Record<string, string[]>, // { companies: ['id', 'name'], contacts: ['email'] }
  joins?: string[],          // ['companies.id = contacts.companyId']
  timeField?: string         // 'companies.createdAt'
}
```

**Reduction: 60% fewer fields, eliminates nested objects**

### 3. SQL Builder (sql-builder.ts)

#### Current AI Context Needs:
- **User query**: CRITICAL - Natural language intent
- **Selected schema**: CRITICAL - But can be reference
- **SQL hints**: HELPFUL - But can be simplified
- **Vector IDs**: OPTIONAL - Only for hybrid

#### Key Insight: SQL Builder difficulty estimation
```typescript
// Current: 10 factors, complex scoring
// This is good for model selection but adds overhead

// Optimization: Pre-compute during analysis phase
// Pass difficulty as simple enum from analyzer
```

#### Simplified Output:
```typescript
// Current: Multiple optional fields
{
  sql: string,
  queryType: enum,
  estimatedRows?: enum,
  usesIndex: boolean,
  warnings?: string[],
  explanation?: string
}

// Simplified: Just essentials
{
  sql: string,
  queryType: 'SELECT' | 'AGGREGATE'  // Just 2 types
}
```

**Reduction: 67% fewer fields**

### 4. Vector Search (vector-search.ts)

#### No AI Generation Required!
- This step doesn't use generateObject
- Pure computational: embedding + search
- Already optimized

### 5. Result Fusion (result-fusion.ts)

#### Current AI Context Needs:
- **User query**: CRITICAL - For understanding intent
- **Vector results with scores**: CRITICAL - For ranking
- **SQL results**: CRITICAL - For merging
- **Result limit**: HELPFUL

#### Current Output:
```typescript
// Currently returns array of generic records
// This is already simple and appropriate
```

## Implementation Strategy

### Phase 1: Simplify Structured Outputs (Week 1)

1. **Query Analyzer** - Reduce to 8 fields
   ```typescript
   // Update QueryAnalysisSchema to SimpleQueryAnalysisSchema
   export const SimpleQueryAnalysisSchema = z.object({
     routing: z.object({
       strategy: z.enum(["sql_only", "vector_only", "hybrid", "rejected"]),
       confidence: z.number()
     }),
     sqlTables: z.array(z.string()).optional(),
     vectorQueries: z.array(z.object({
       table: z.string(),
       field: z.string(), 
       query: z.string()
     })).optional(),
     feasible: z.boolean(),
     reason: z.string().optional()
   });
   ```

2. **Schema Selector** - Flatten structure
   ```typescript
   export const SimpleSchemaResultSchema = z.object({
     tables: z.array(z.string()),
     fields: z.record(z.array(z.string())),
     joins: z.array(z.string()).optional(),
     timeField: z.string().optional()
   });
   ```

3. **SQL Builder** - Minimal output
   ```typescript
   export const SimpleSQLResultSchema = z.object({
     sql: z.string(),
     queryType: z.enum(["SELECT", "AGGREGATE"])
   });
   ```

### Phase 2: Smart Context Passing (Week 2)

1. **Schema Registry Enhancement**
   ```typescript
   class SchemaRegistry {
     // Add method to get AI-friendly context
     getAIContext(schemaId: string, tables: string[]): AISchemaContext {
       return {
         tables,
         totalFields: this.countFields(tables),
         keyRelations: this.getKeyRelations(tables),
         hasTimeFields: this.hasTimeFields(tables),
         hasTextFields: this.hasTextFields(tables)
       };
     }
   }
   ```

2. **Query Context Enhancement**
   ```typescript
   interface QueryContext {
     // Add AI-specific context
     aiContext: {
       queryComplexity: 'simple' | 'moderate' | 'complex',
       requiresPrecision: boolean,
       modelHint: 'fast' | 'balanced' | 'accurate'
     }
   }
   ```

### Phase 3: Prompt Optimization (Week 3)

1. **Focused Prompts** - Each step gets only relevant context
2. **Example-Driven** - Include minimal examples in prompts
3. **Clear Constraints** - Specify exact output format

## Expected Benefits

### 1. **AI Generation Speed**
- 40-60% faster generation with simpler schemas
- 50% fewer validation errors
- 30% reduction in token usage

### 2. **Maintained Precision**
- All critical context preserved
- Simplified doesn't mean less accurate
- Better focus on essential decisions

### 3. **System Performance**
- 70% less data serialization
- 80% faster schema validation
- 50% smaller cache footprint

## Critical Success Factors

### ✅ DO Preserve:
1. **Full table relationships** in analyzer (for routing decisions)
2. **Semantic field mappings** (for vector search)
3. **User query verbatim** (for intent understanding)
4. **Score/ranking data** (for result fusion)

### ❌ DON'T Remove:
1. **Error context** for debugging
2. **Cache keys** for performance
3. **Execution metadata** for monitoring

### 🎯 DO Simplify:
1. **Nested objects** → Flat structures
2. **Optional fields** → Remove if rarely used
3. **Enums with many values** → Reduce to essential options
4. **Explanations** → Combine into single field

## Next Actions

1. Start with Query Analyzer simplification (highest impact)
2. Test simplified schemas with real queries
3. Measure generation time improvements
4. Iterate based on accuracy metrics