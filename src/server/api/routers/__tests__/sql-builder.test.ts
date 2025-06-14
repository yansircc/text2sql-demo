import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { sqlBuilderRouter } from "../sql-builder";
import { createTestContext, withSuppressedConsoleError } from "./test-helpers";

// Create mock functions
const mockGenerateObject = jest.fn(() => Promise.resolve({ object: {} }));

// Mock the AI SDK
mock.module("ai", () => ({
	generateObject: mockGenerateObject,
}));

mock.module("@ai-sdk/anthropic", () => ({
	createAnthropic: jest.fn(() => {
		return jest.fn((model) => ({
			modelId: model,
			provider: "anthropic",
		}));
	}),
}));

describe("sqlBuilderRouter", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	test("build should generate simple SELECT query", async () => {
		const mockSqlResult = {
			sql: "SELECT id, name, email FROM customers WHERE created_at > '2024-01-01' ORDER BY created_at DESC;",
			queryType: "SELECT",
			estimatedRows: "moderate",
			usesIndex: true,
			warnings: [],
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Show all customers created this year",
			slimSchema: {
				customers: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						email: { type: "TEXT", nullable: true },
						created_at: { type: "TIMESTAMP", nullable: true },
					},
				},
			},
			selectedTables: [
				{
					tableName: "customers",
					fields: ["id", "name", "email", "created_at"],
					reason: "Contains customer information",
					isJoinTable: false,
				},
			],
			sqlHints: {
				timeFields: [
					{
						table: "customers",
						field: "created_at",
						dataType: "integer",
						format: "timestamp",
					},
				],
				indexedFields: ["id", "created_at"],
			},
		});

		expect(result.success).toBe(true);
		expect(result.result.sql).toContain("SELECT");
		expect(result.result.sql).toContain("customers");
		expect(result.result.queryType).toBe("SELECT");
		expect(result.result.estimatedRows).toBe("moderate");
		expect(result.result.usesIndex).toBe(true);
		expect(result.result.warnings).toHaveLength(0);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	test("build should generate aggregate query with GROUP BY", async () => {
		const mockSqlResult = {
			sql: "SELECT customer_id, COUNT(*) as order_count, SUM(total) as total_revenue FROM orders GROUP BY customer_id HAVING COUNT(*) > 5 ORDER BY total_revenue DESC;",
			queryType: "AGGREGATE",
			estimatedRows: "few",
			usesIndex: true,
			warnings: [],
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Show customers with more than 5 orders and their total revenue",
			slimSchema: {
				orders: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						customer_id: { type: "INTEGER", nullable: true },
						total: { type: "DECIMAL", nullable: true },
					},
				},
			},
			selectedTables: [
				{
					tableName: "orders",
					fields: ["customer_id", "total"],
					reason: "Contains order data for aggregation",
					isJoinTable: false,
				},
			],
			sqlHints: {
				indexedFields: ["customer_id"],
			},
		});

		expect(result.result.queryType).toBe("AGGREGATE");
		expect(result.result.sql).toContain("GROUP BY");
		expect(result.result.sql).toContain("COUNT");
		expect(result.result.estimatedRows).toBe("few");
	});

	test("build should generate complex JOIN query", async () => {
		const mockSqlResult = {
			sql: "SELECT c.name, c.email, COUNT(o.id) as order_count FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE c.created_at > '2024-01-01' GROUP BY c.id, c.name, c.email ORDER BY order_count DESC LIMIT 10;",
			queryType: "COMPLEX",
			estimatedRows: "few",
			usesIndex: true,
			warnings: [],
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Show top 10 customers by order count this year",
			slimSchema: {
				customers: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						email: { type: "TEXT", nullable: true },
						created_at: { type: "TIMESTAMP", nullable: true },
					},
				},
				orders: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						customer_id: { type: "INTEGER", nullable: true },
					},
				},
			},
			selectedTables: [
				{
					tableName: "customers",
					fields: ["id", "name", "email", "created_at"],
					reason: "Main table for customer data",
					isJoinTable: false,
				},
				{
					tableName: "orders",
					fields: ["id", "customer_id"],
					reason: "Join table for order counts",
					isJoinTable: true,
				},
			],
			sqlHints: {
				joinHints: [
					{
						from: "customers",
						to: "orders",
						on: "customers.id = orders.customer_id",
						type: "LEFT",
					},
				],
				indexedFields: ["customers.id", "orders.customer_id"],
			},
		});

		expect(result.result.queryType).toBe("COMPLEX");
		expect(result.result.sql).toContain("JOIN");
		expect(result.result.sql).toContain("GROUP BY");
		expect(result.result.sql).toContain("LIMIT");
	});

	test("build should handle fuzzy search patterns", async () => {
		const mockSqlResult = {
			sql: "SELECT * FROM companies WHERE name LIKE '%Microsft%' OR name LIKE '%Microsoft%';",
			queryType: "SELECT",
			estimatedRows: "few",
			usesIndex: false,
			warnings: ["LIKE queries may not use indexes efficiently"],
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Find company named Microsft",
			slimSchema: {
				companies: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
					},
				},
			},
			selectedTables: [
				{
					tableName: "companies",
					fields: ["id", "name"],
					reason: "Search for company by name",
					isJoinTable: false,
				},
			],
			sqlHints: {
				fuzzyPatterns: ["Microsft", "Microsoft"],
			},
		});

		expect(result.result.sql).toContain("LIKE");
		expect(result.result.warnings).toHaveLength(1);
		expect(result.result.usesIndex).toBe(false);
	});

	test("build should handle vector search integration with WHERE IN", async () => {
		const mockSqlResult = {
			sql: "SELECT * FROM companies WHERE id IN (1, 2, 3, 5, 8) ORDER BY name;",
			queryType: "SELECT",
			estimatedRows: "few",
			usesIndex: true,
			warnings: [],
			explanation: "Using vector search results to filter companies",
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Show companies similar to Tesla",
			slimSchema: {
				companies: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						industry: { type: "TEXT", nullable: true },
					},
				},
			},
			selectedTables: [
				{
					tableName: "companies",
					fields: ["id", "name", "industry"],
					reason: "Filtered by vector search results",
					isJoinTable: false,
				},
			],
			sqlHints: {
				vectorIds: [1, 2, 3, 5, 8],
				indexedFields: ["id"],
			},
		});

		expect(result.result.sql).toContain("WHERE id IN");
		expect(result.result.sql).toContain("(1, 2, 3, 5, 8)");
		expect(result.result.explanation).toBeDefined();
		expect(result.result.usesIndex).toBe(true);
	});

	test("build should use time context for relative dates", async () => {
		const mockSqlResult = {
			sql: "SELECT * FROM orders WHERE created_at >= '2024-05-01' AND created_at < '2024-06-01';",
			queryType: "SELECT",
			estimatedRows: "moderate",
			usesIndex: true,
			warnings: [],
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Show orders from last month",
			slimSchema: {
				orders: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						created_at: { type: "TIMESTAMP", nullable: true },
						total: { type: "DECIMAL", nullable: true },
					},
				},
			},
			selectedTables: [
				{
					tableName: "orders",
					fields: ["id", "created_at", "total"],
					reason: "Contains order data",
					isJoinTable: false,
				},
			],
			sqlHints: {
				timeFields: [
					{
						table: "orders",
						field: "created_at",
						dataType: "integer",
						format: "timestamp",
					},
				],
			},
			timeContext: {
				currentTime: "2024-06-15T10:00:00Z",
				timezone: "UTC",
			},
		});

		expect(result.result.sql).toContain("created_at");
		expect(result.result.sql).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
	});

	test("build should handle multiple warnings", async () => {
		const mockSqlResult = {
			sql: "SELECT * FROM huge_table WHERE description LIKE '%keyword%' ORDER BY RANDOM() LIMIT 1000;",
			queryType: "SELECT",
			estimatedRows: "many",
			usesIndex: false,
			warnings: [
				"LIKE queries on non-indexed fields can be slow",
				"ORDER BY RANDOM() is computationally expensive",
				"Large LIMIT without proper filtering may impact performance",
			],
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Show random 1000 records containing keyword",
			slimSchema: {
				huge_table: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						description: { type: "TEXT", nullable: true },
					},
				},
			},
			selectedTables: [
				{
					tableName: "huge_table",
					fields: ["id", "description"],
					reason: "Search in large table",
					isJoinTable: false,
				},
			],
			sqlHints: {},
		});

		expect(result.result.warnings).toHaveLength(3);
		expect(result.result.estimatedRows).toBe("many");
		expect(result.result.usesIndex).toBe(false);
	});

	test("build should handle errors gracefully", withSuppressedConsoleError(async () => {
		// Clear any previous mock implementations
		mockGenerateObject.mockReset();
		mockGenerateObject.mockImplementation(() => 
			Promise.reject(new Error("AI service unavailable"))
		);

		const caller = sqlBuilderRouter.createCaller(createTestContext());

		await expect(
			caller.build({
				query: "Show all data",
				slimSchema: {},
				selectedTables: [],
				sqlHints: {},
			})
		).rejects.toThrow("SQL构建失败");
	}));

	test("build should handle empty schema", async () => {
		const mockSqlResult = {
			sql: "SELECT 'No tables available' as message;",
			queryType: "SELECT",
			estimatedRows: "few",
			usesIndex: false,
			warnings: ["No tables provided in schema"],
		};

		mockGenerateObject.mockResolvedValue({ object: mockSqlResult });

		const caller = sqlBuilderRouter.createCaller(createTestContext());
		const result = await caller.build({
			query: "Show all data",
			slimSchema: {},
			selectedTables: [],
			sqlHints: {},
		});

		expect(result.result.warnings).toContain("No tables provided in schema");
		expect(result.result.estimatedRows).toBe("few");
	});
});