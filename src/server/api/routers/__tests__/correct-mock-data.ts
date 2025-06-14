/**
 * Correct mock data structures that match the expected types
 */

// For query-analyzer.ts - matches QueryAnalysisSchema
export const correctQueryAnalysisMock = {
  // SQL-only strategy example
  sqlOnly: {
    queryId: "test-123",
    originalQuery: "Show all orders from last month",
    timestamp: new Date().toISOString(),
    feasibility: {
      isFeasible: true,
      // reason and suggestedAlternatives are optional
    },
    clarity: {
      isClear: true,
      // missingInfo is optional
    },
    routing: {
      strategy: "sql_only" as const,
      reason: "Query is structured and can be handled by SQL alone",
      confidence: 0.95,
    },
    // sqlConfig matches the schema definition
    sqlConfig: {
      tables: ["orders"], // array of strings
      canUseFuzzySearch: false, // boolean
      fuzzyPatterns: ["pattern1"], // optional array of strings
      estimatedComplexity: "simple" as const, // enum: "simple" | "moderate" | "complex"
    },
    // vectorConfig is optional
    // hybridConfig is optional
  },

  // Vector-only strategy example
  vectorOnly: {
    queryId: "test-456",
    originalQuery: "Find companies working on sustainable energy",
    timestamp: new Date().toISOString(),
    feasibility: {
      isFeasible: true,
    },
    clarity: {
      isClear: true,
    },
    routing: {
      strategy: "vector_only" as const,
      reason: "Query requires semantic understanding and similarity search",
      confidence: 0.9,
    },
    // vectorConfig matches the schema definition
    vectorConfig: {
      queries: [
        {
          table: "companies",
          fields: ["description", "mission"],
          searchText: "sustainable energy renewable clean tech",
          limit: 10,
        },
      ],
      requiresReranking: false,
    },
  },

  // Hybrid strategy example
  hybrid: {
    queryId: "test-789",
    originalQuery: "Show recent orders for companies similar to Tesla",
    timestamp: new Date().toISOString(),
    feasibility: {
      isFeasible: true,
    },
    clarity: {
      isClear: true,
    },
    routing: {
      strategy: "hybrid" as const,
      reason: "Query requires both semantic search and structured filtering",
      confidence: 0.85,
    },
    sqlConfig: {
      tables: ["orders", "companies"],
      canUseFuzzySearch: false,
      estimatedComplexity: "complex" as const,
    },
    vectorConfig: {
      queries: [
        {
          table: "companies",
          fields: ["description", "industry"],
          searchText: "Tesla electric vehicles automotive technology",
          limit: 10,
        },
      ],
      requiresReranking: true,
    },
    hybridConfig: {
      description: "First perform vector search to find similar companies, then join with orders table for recent data",
    },
  },

  // Rejected strategy example
  rejected: {
    queryId: "test-404",
    originalQuery: "What is the meaning of life?",
    timestamp: new Date().toISOString(),
    feasibility: {
      isFeasible: false,
      reason: "Query is philosophical and outside the scope of data retrieval",
      suggestedAlternatives: ["Try searching for specific company or order information"],
    },
    clarity: {
      isClear: true,
    },
    routing: {
      strategy: "rejected" as const,
      reason: "Query cannot be processed by the system",
      confidence: 1.0,
    },
  },

  // Unclear query example
  unclear: {
    queryId: "test-unclear",
    originalQuery: "Show the data",
    timestamp: new Date().toISOString(),
    feasibility: {
      isFeasible: true,
    },
    clarity: {
      isClear: false,
      missingInfo: [
        { field: "table", description: "Which data table to query?" },
        { field: "filters", description: "Any specific filters or time range?" },
      ],
    },
    routing: {
      strategy: "rejected" as const,
      reason: "Query is too vague to process accurately",
      confidence: 0.3,
    },
  },
};

// For schema-selector.ts - matches SchemaSelectorResultSchema
export const correctSchemaSelectorMock = {
  // Simple query example
  simple: {
    selectedTables: [
      {
        tableName: "orders",
        fields: ["id", "customer_id", "total", "created_at"],
        reason: "Contains order information needed for the query",
        isJoinTable: false, // boolean with default false
      },
    ],
    slimSchema: { // record of any
      orders: {
        columns: {
          id: { type: "INTEGER", nullable: false },
          customer_id: { type: "INTEGER", nullable: true },
          total: { type: "DECIMAL", nullable: true },
          created_at: { type: "TIMESTAMP", nullable: true },
        },
      },
    },
    compressionRatio: 0.75, // number
    sqlHints: {
      timeFields: [
        {
          table: "orders",
          field: "created_at",
          dataType: "integer" as const, // enum: "integer" | "text" | "real"
          format: "timestamp" as const, // enum: "timestamp" | "datetime" | "date"
        },
      ],
      joinHints: undefined, // optional
      indexedFields: ["id"], // optional array of strings
    },
  },

  // Multi-table join example
  multiTable: {
    selectedTables: [
      {
        tableName: "orders",
        fields: ["id", "customer_id", "total", "created_at"],
        reason: "Main table for order data",
        isJoinTable: false,
      },
      {
        tableName: "customers",
        fields: ["id", "name", "email"],
        reason: "Customer details for join relationship",
        isJoinTable: true,
      },
    ],
    slimSchema: {
      orders: {
        columns: {
          id: { type: "INTEGER", nullable: false },
          customer_id: { type: "INTEGER", nullable: true },
          total: { type: "DECIMAL", nullable: true },
          created_at: { type: "TIMESTAMP", nullable: true },
        },
      },
      customers: {
        columns: {
          id: { type: "INTEGER", nullable: false },
          name: { type: "TEXT", nullable: true },
          email: { type: "TEXT", nullable: true },
        },
      },
    },
    compressionRatio: 0.65,
    sqlHints: {
      timeFields: [
        {
          table: "orders",
          field: "created_at",
          dataType: "integer" as const,
          format: "timestamp" as const,
        },
      ],
      joinHints: [
        {
          from: "orders",
          to: "customers",
          on: "orders.customer_id = customers.id",
          type: "LEFT" as const, // enum: "INNER" | "LEFT" | "RIGHT"
        },
      ],
      indexedFields: ["orders.id", "customers.id", "orders.customer_id"],
    },
  },

  // Vector context example
  withVectorContext: {
    selectedTables: [
      {
        tableName: "companies",
        fields: ["id", "name", "industry", "description"],
        reason: "Company data filtered by vector search results",
        isJoinTable: false,
      },
      {
        tableName: "orders",
        fields: ["id", "company_id", "total", "created_at"],
        reason: "Order data to join with filtered companies",
        isJoinTable: true,
      },
    ],
    slimSchema: {
      companies: {
        columns: {
          id: { type: "INTEGER", nullable: false },
          name: { type: "TEXT", nullable: true },
          industry: { type: "TEXT", nullable: true },
          description: { type: "TEXT", nullable: true },
        },
      },
      orders: {
        columns: {
          id: { type: "INTEGER", nullable: false },
          company_id: { type: "INTEGER", nullable: true },
          total: { type: "DECIMAL", nullable: true },
          created_at: { type: "TIMESTAMP", nullable: true },
        },
      },
    },
    compressionRatio: 0.5,
    sqlHints: {
      timeFields: [
        {
          table: "orders",
          field: "created_at",
          dataType: "integer" as const,
          format: "timestamp" as const,
        },
      ],
      joinHints: [
        {
          from: "orders",
          to: "companies",
          on: "orders.company_id = companies.id",
          type: "INNER" as const,
        },
      ],
      indexedFields: ["companies.id", "orders.company_id"],
    },
  },
};

// Example of how to use these in tests:
/*
// In query-analyzer.test.ts
mockGenerateObject.mockResolvedValue({ object: correctQueryAnalysisMock.sqlOnly });

// In schema-selector.test.ts
mockGenerateObject.mockResolvedValue({ object: correctSchemaSelectorMock.simple });
*/