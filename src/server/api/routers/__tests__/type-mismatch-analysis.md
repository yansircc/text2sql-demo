# Type Mismatch Analysis for Test Files

## Query Analyzer Router Type Mismatches

### 1. SQL Config Structure
**Current Test Mock (INCORRECT):**
```typescript
sqlConfig: {
  requiresTables: ["orders"],  // ❌ Wrong property name
  requiresJoins: false,         // ❌ Not in schema
  timeConstraints: {...},       // ❌ Not in schema
  aggregations: {...},          // ❌ Not in schema
  sorting: {...},               // ❌ Not in schema
  filtering: {...},             // ❌ Not in schema
  fuzzySearch: {...}            // ❌ Not in schema
}
```

**Expected Schema (CORRECT):**
```typescript
sqlConfig: {
  tables: string[],                    // ✅ Array of table names
  canUseFuzzySearch: boolean,          // ✅ Boolean flag
  fuzzyPatterns?: string[],            // ✅ Optional array
  estimatedComplexity: "simple" | "moderate" | "complex"  // ✅ Enum
}
```

### 2. Vector Config Structure
**Current Test Mock (INCORRECT):**
```typescript
vectorConfig: {
  searchTerms: ["sustainable energy"],  // ❌ Wrong structure
  targetCollections: ["companies"],     // ❌ Not in schema
  targetFields: ["description"],        // ❌ Not in schema
  semanticIntent: "Find companies..."   // ❌ Not in schema
}
```

**Expected Schema (CORRECT):**
```typescript
vectorConfig: {
  queries: [                           // ✅ Array of query objects
    {
      table: string,                   // ✅ Table name
      fields: string[],                // ✅ Array of fields
      searchText: string,              // ✅ Search text
      limit: number                    // ✅ Result limit (default 10)
    }
  ],
  requiresReranking: boolean           // ✅ Boolean (default false)
}
```

## Schema Selector Router Type Mismatches

### 1. Selected Tables Structure
**Current Test Mock (INCORRECT):**
```typescript
selectedTables: [
  {
    tableName: "orders",
    fields: [...],
    reason: "...",
    priority: 1         // ❌ Not in schema
  }
]
```

**Expected Schema (CORRECT):**
```typescript
selectedTables: [
  {
    tableName: string,
    fields: string[],
    reason: string,
    isJoinTable: boolean  // ✅ Required (default false)
  }
]
```

### 2. Slim Schema Structure
**Current Test Mock (INCORRECT):**
```typescript
slimSchema: "CREATE TABLE orders (...);"  // ❌ String instead of object
```

**Expected Schema (CORRECT):**
```typescript
slimSchema: Record<string, any>  // ✅ Object/record type
```

### 3. SQL Hints Structure
**Current Test Mock (INCORRECT):**
```typescript
// Uses completely different structure with:
optimizations: {...}  // ❌ Not in schema
searchHints: {...}    // ❌ Wrong property name
```

**Expected Schema (CORRECT):**
```typescript
sqlHints: {
  timeFields?: [
    {
      table: string,
      field: string,
      dataType: "integer" | "text" | "real",
      format: "timestamp" | "datetime" | "date"
    }
  ],
  joinHints?: [
    {
      from: string,
      to: string,
      on: string,
      type: "INNER" | "LEFT" | "RIGHT"
    }
  ],
  indexedFields?: string[]
}
```

### 4. Missing Required Field
**Current Test Mock (MISSING):**
```typescript
// Missing compressionRatio field
```

**Expected Schema (CORRECT):**
```typescript
compressionRatio: number  // ✅ Required field
```

## How to Fix the Tests

1. **Import the correct mock data:**
   ```typescript
   import { correctQueryAnalysisMock, correctSchemaSelectorMock } from "./correct-mock-data";
   ```

2. **Update query-analyzer tests:**
   ```typescript
   // Replace the mock data with correct structure
   mockGenerateObject.mockResolvedValue({ 
     object: correctQueryAnalysisMock.sqlOnly 
   });
   ```

3. **Update schema-selector tests:**
   ```typescript
   // Replace the mock data with correct structure
   mockGenerateObject.mockResolvedValue({ 
     object: correctSchemaSelectorMock.simple 
   });
   ```

4. **Update test assertions to match the new structure:**
   - Remove assertions for non-existent fields
   - Add assertions for required fields like `compressionRatio`
   - Update property names to match the schema