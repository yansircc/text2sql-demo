import { createHash } from "crypto";

export interface SchemaReference {
  schemaId: string;
  version: string;
  timestamp: number;
}

export interface SchemaMetadata {
  tables: string[];
  totalFields: number;
  indexedFields: string[];
  vectorizedFields: Record<string, string[]>;
}

class SchemaRegistry {
  private schemas = new Map<string, {
    fullSchema: any;
    metadata: SchemaMetadata;
    parsedAt: number;
  }>();
  
  private generateSchemaId(schema: string): string {
    return createHash("md5").update(schema).digest("hex");
  }
  
  register(schemaString: string): SchemaReference {
    const schemaId = this.generateSchemaId(schemaString);
    
    if (!this.schemas.has(schemaId)) {
      const parsed = JSON.parse(schemaString);
      const metadata = this.extractMetadata(parsed);
      
      this.schemas.set(schemaId, {
        fullSchema: parsed,
        metadata,
        parsedAt: Date.now()
      });
    }
    
    return {
      schemaId,
      version: "1.0",
      timestamp: Date.now()
    };
  }
  
  getSchema(schemaId: string): any {
    return this.schemas.get(schemaId)?.fullSchema;
  }
  
  getFilteredSchema(schemaId: string, tables: string[]): any {
    const fullSchema = this.getSchema(schemaId);
    if (!fullSchema) return null;
    
    const filtered: Record<string, any> = {};
    tables.forEach(table => {
      if (fullSchema[table]) {
        filtered[table] = fullSchema[table];
      }
    });
    
    return filtered;
  }
  
  private extractMetadata(schema: any): SchemaMetadata {
    const tables = Object.keys(schema);
    let totalFields = 0;
    const indexedFields: string[] = [];
    const vectorizedFields: Record<string, string[]> = {};
    
    tables.forEach(table => {
      const tableSchema = schema[table];
      totalFields += Object.keys(tableSchema.columns || {}).length;
      
      // Extract indexed fields (assuming they're marked somehow)
      // This is a placeholder - adjust based on your schema structure
    });
    
    return { tables, totalFields, indexedFields, vectorizedFields };
  }
  
  clear() {
    this.schemas.clear();
  }
  
  size() {
    return this.schemas.size;
  }
}

export const schemaRegistry = new SchemaRegistry();