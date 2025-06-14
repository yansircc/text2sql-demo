/**
 * Schema utility functions for progressive schema refinement
 * Reduces parsing overhead while maintaining AI context quality
 */

interface TableSummary {
	name: string;
	description: string;
	recordCount?: number;
	keyColumns?: string[];
	relationships?: {
		table: string;
		type: "one-to-many" | "many-to-one" | "one-to-one";
	}[];
}

interface MinimalSchema {
	tables: TableSummary[];
	totalTables: number;
}

interface FilteredSchema {
	tables: Record<
		string,
		{
			columns: Array<{
				name: string;
				type: string;
				nullable?: boolean;
				isPrimary?: boolean;
				isForeign?: boolean;
				references?: { table: string; column: string };
			}>;
			indexes?: string[];
			description?: string;
		}
	>;
	relationships: Array<{
		from: { table: string; column: string };
		to: { table: string; column: string };
		type: string;
	}>;
}

/**
 * Get minimal schema for query analysis
 * Only includes table names, descriptions, and key relationships
 */
export function getMinimalSchema(fullSchema: any): MinimalSchema {
	const tables: TableSummary[] = [];

	// Extract table summaries
	const schemaObj =
		typeof fullSchema === "string" ? JSON.parse(fullSchema) : fullSchema;

	for (const [tableName, tableInfo] of Object.entries(schemaObj)) {
		const summary: TableSummary = {
			name: tableName,
			description: getTableDescription(tableName),
			keyColumns: [],
			relationships: [],
		};

		// Extract key columns (primary keys, foreign keys)
		if (tableInfo && typeof tableInfo === "object") {
			const columns = (tableInfo as any).columns || [];
			for (const col of columns) {
				if (col.isPrimary || col.isForeign) {
					summary.keyColumns!.push(col.name);
				}
				if (col.references) {
					summary.relationships!.push({
						table: col.references.table,
						type: "many-to-one",
					});
				}
			}
		}

		tables.push(summary);
	}

	return {
		tables,
		totalTables: tables.length,
	};
}

/**
 * Get filtered schema for specific tables with relationships
 * Includes related tables that might be needed for JOINs
 */
export function getFilteredSchema(
	fullSchema: any,
	requestedTables: string[],
): FilteredSchema {
	const schemaObj =
		typeof fullSchema === "string" ? JSON.parse(fullSchema) : fullSchema;
	const filteredTables: FilteredSchema["tables"] = {};
	const relationships: FilteredSchema["relationships"] = [];
	const tablesToInclude = new Set(requestedTables);

	// First pass: include requested tables
	for (const table of requestedTables) {
		if (schemaObj[table]) {
			filteredTables[table] = schemaObj[table];

			// Find related tables through foreign keys
			const columns = schemaObj[table].columns || [];
			for (const col of columns) {
				if (col.references) {
					tablesToInclude.add(col.references.table);
					relationships.push({
						from: { table, column: col.name },
						to: { table: col.references.table, column: col.references.column },
						type: "foreign_key",
					});
				}
			}
		}
	}

	// Second pass: include related tables
	for (const table of tablesToInclude) {
		if (!filteredTables[table] && schemaObj[table]) {
			filteredTables[table] = schemaObj[table];
		}
	}

	return { tables: filteredTables, relationships };
}

/**
 * Get detailed schema for SQL building
 * Only includes selected tables with full column details
 */
export function getDetailedSchema(
	fullSchema: any,
	selectedTables: string[],
): Record<string, any> {
	const schemaObj =
		typeof fullSchema === "string" ? JSON.parse(fullSchema) : fullSchema;
	const detailed: Record<string, any> = {};

	for (const table of selectedTables) {
		if (schemaObj[table]) {
			detailed[table] = {
				...schemaObj[table],
				// Add computed properties for SQL building
				primaryKey: getPrimaryKeyColumn(schemaObj[table]),
				foreignKeys: getForeignKeyColumns(schemaObj[table]),
				textColumns: getTextSearchableColumns(schemaObj[table]),
			};
		}
	}

	return detailed;
}

/**
 * Table descriptions for better AI understanding
 */
function getTableDescription(tableName: string): string {
	const descriptions: Record<string, string> = {
		text2sql_companies:
			"Customer company records with business details and status",
		text2sql_contacts: "Contact persons within customer companies",
		text2sql_salesUsers: "Sales team members and representatives",
		text2sql_companyUserRelations:
			"Relationships between companies and sales users",
		text2sql_followUps: "Customer interaction and follow-up records",
		text2sql_opportunities: "Sales opportunities and deals",
		text2sql_whatsappMessages: "WhatsApp communication history",
	};

	return descriptions[tableName] || "Data table";
}

// Helper functions
function getPrimaryKeyColumn(tableSchema: any): string | null {
	const columns = tableSchema.columns || [];
	const pk = columns.find((col: any) => col.isPrimary);
	return pk ? pk.name : null;
}

function getForeignKeyColumns(
	tableSchema: any,
): Array<{ column: string; references: any }> {
	const columns = tableSchema.columns || [];
	return columns
		.filter((col: any) => col.isForeign || col.references)
		.map((col: any) => ({ column: col.name, references: col.references }));
}

function getTextSearchableColumns(tableSchema: any): string[] {
	const columns = tableSchema.columns || [];
	return columns
		.filter(
			(col: any) =>
				col.type?.toLowerCase().includes("text") ||
				col.type?.toLowerCase().includes("varchar") ||
				col.type?.toLowerCase().includes("string"),
		)
		.map((col: any) => col.name);
}

/**
 * Cache schema parsing results
 */
const schemaCache = new Map<string, any>();

export function getCachedSchema<T>(key: string, generator: () => T): T {
	if (schemaCache.has(key)) {
		return schemaCache.get(key);
	}

	const result = generator();
	schemaCache.set(key, result);

	// Clear cache after 5 minutes
	setTimeout(() => schemaCache.delete(key), 5 * 60 * 1000);

	return result;
}
