import type { SchemaReference } from "./schema-registry";

export interface QueryContext {
  queryId: string;
  originalQuery: string;
  schemaRef: SchemaReference;
  routing: {
    strategy: "sql_only" | "vector_only" | "hybrid" | "rejected";
    confidence: number;
  };
  
  // Lazy-loaded data - only populated when needed
  analysis?: any; // Avoid circular dependency
  vectorContext?: {
    hasResults: boolean;
    ids: number[];
    topMatches: Array<{
      id: number;
      score: number;
      matchedField: string;
    }>;
  };
  
  // Metadata for tracking
  createdAt: number;
  steps: string[];
}

export class QueryContextManager {
  private contexts = new Map<string, QueryContext>();
  
  create(queryId: string, query: string, schemaRef: SchemaReference): QueryContext {
    const context: QueryContext = {
      queryId,
      originalQuery: query,
      schemaRef,
      routing: {
        strategy: "rejected",
        confidence: 0
      },
      createdAt: Date.now(),
      steps: []
    };
    
    this.contexts.set(queryId, context);
    return context;
  }
  
  get(queryId: string): QueryContext | undefined {
    return this.contexts.get(queryId);
  }
  
  update(queryId: string, updates: Partial<QueryContext>): void {
    const context = this.contexts.get(queryId);
    if (context) {
      Object.assign(context, updates);
    }
  }
  
  addStep(queryId: string, step: string): void {
    const context = this.contexts.get(queryId);
    if (context) {
      context.steps.push(step);
    }
  }
  
  cleanup(olderThan: number = 3600000): void { // 1 hour default
    const now = Date.now();
    for (const [queryId, context] of this.contexts.entries()) {
      if (now - context.createdAt > olderThan) {
        this.contexts.delete(queryId);
      }
    }
  }
}

export const queryContextManager = new QueryContextManager();