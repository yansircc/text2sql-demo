import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { workflowOrchestratorRouter } from "../workflow-orchestrator";
import { createTestContext, withSuppressedConsoleError } from "./test-helpers";

// Mock the createCaller function from root
const mockApiCaller = {
	queryAnalyzer: {
		analyze: jest.fn<any>(),
	},
	vectorSearch: {
		search: jest.fn<any>(),
	},
	schemaSelector: {
		select: jest.fn<any>(),
	},
	sqlBuilder: {
		build: jest.fn<any>(),
	},
	sqlExecutor: {
		execute: jest.fn<any>(),
	},
	resultFusion: {
		fuse: jest.fn<any>(),
	},
};

// Mock the dynamic import of root
mock.module("@/server/api/root", () => ({
	createCaller: jest.fn(() => mockApiCaller),
}));

describe("workflowOrchestratorRouter", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	test("execute should handle SQL-only workflow successfully", async () => {
		// Mock query analysis result for SQL-only strategy
		mockApiCaller.queryAnalyzer.analyze.mockResolvedValue({
			success: true,
			analysis: {
				queryId: "test-sql-only",
				originalQuery: "Show all customers from last month",
				timestamp: new Date().toISOString(),
				feasibility: { isFeasible: true },
				clarity: { isClear: true },
				routing: {
					strategy: "sql_only",
					reason: "Structured query best handled by SQL",
					confidence: 0.95,
				},
				sqlConfig: {
					tables: ["customers"],
					canUseFuzzySearch: false,
					estimatedComplexity: "simple",
				},
			},
			executionTime: 100,
		});

		// Mock schema selection
		mockApiCaller.schemaSelector.select.mockResolvedValue({
			success: true,
			result: {
				slimSchema: {
					customers: {
						properties: {
							id: { type: "INTEGER", nullable: false },
							name: { type: "TEXT", nullable: true },
							created_at: { type: "TIMESTAMP", nullable: true },
						},
					},
				},
				selectedTables: [
					{
						tableName: "customers",
						fields: ["id", "name", "created_at"],
						reason: "Contains customer data",
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
				},
			},
			executionTime: 50,
		});

		// Mock SQL building
		mockApiCaller.sqlBuilder.build.mockResolvedValue({
			success: true,
			result: {
				sql: "SELECT id, name, created_at FROM customers WHERE created_at > '2024-05-01'",
				queryType: "SELECT",
				estimatedRows: "moderate",
				usesIndex: true,
				warnings: [],
			},
			executionTime: 80,
		});

		// Mock SQL execution
		mockApiCaller.sqlExecutor.execute.mockResolvedValue({
			success: true,
			result: {
				rows: [
					{ id: 1, name: "John Doe", created_at: "2024-05-15" },
					{ id: 2, name: "Jane Smith", created_at: "2024-05-20" },
				],
				rowCount: 2,
				columns: ["id", "name", "created_at"],
				truncated: false,
			},
			executionTime: 120,
		});

		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			query: "Show all customers from last month",
			databaseSchema: JSON.stringify({
				customers: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						created_at: { type: "TIMESTAMP", nullable: true },
					},
				},
			}),
		});

		expect(result.status).toBe("success");
		expect(result.strategy).toBe("sql_only");
		expect(result.queryId).toBe("test-sql-only");
		expect(result.data).toHaveLength(2);
		expect(result.rowCount).toBe(2);
		expect(result.metadata.steps).toHaveLength(4); // QueryAnalysis, SchemaSelection, SQLBuilding, SQLExecution
		expect(result.metadata.sql).toBeDefined();
		expect(result.metadata.totalTime).toBeGreaterThanOrEqual(0);
	});

	test("execute should handle vector-only workflow successfully", async () => {
		// Mock query analysis result for vector-only strategy
		mockApiCaller.queryAnalyzer.analyze.mockResolvedValue({
			success: true,
			analysis: {
				queryId: "test-vector-only",
				originalQuery: "Find companies working on sustainable energy",
				timestamp: new Date().toISOString(),
				feasibility: { isFeasible: true },
				clarity: { isClear: true },
				routing: {
					strategy: "vector_only",
					reason: "Semantic search required",
					confidence: 0.9,
				},
				vectorConfig: {
					queries: [
						{
							text: "sustainable energy companies",
							table: "companies",
							field: "description",
							limit: 10,
						},
					],
				},
			},
			executionTime: 100,
		});

		// Mock vector search
		mockApiCaller.vectorSearch.search.mockResolvedValue({
			success: true,
			result: {
				results: [
					{
						id: 1,
						score: 0.95,
						table: "companies",
						matchedField: "description",
						payload: {
							id: 1,
							name: "Tesla",
							description: "Electric vehicle and clean energy company",
						},
						rank: 1,
					},
					{
						id: 2,
						score: 0.87,
						table: "companies",
						matchedField: "description",
						payload: {
							id: 2,
							name: "SolarCity",
							description: "Solar energy solutions provider",
						},
						rank: 2,
					},
				],
				searchTime: 45,
				totalResults: 2,
			},
			executionTime: 150,
		});

		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			query: "Find companies working on sustainable energy",
			databaseSchema: JSON.stringify({
				companies: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						description: { type: "TEXT", nullable: true },
					},
				},
			}),
			vectorizedFields: {
				companies: ["description"],
			},
		});

		expect(result.status).toBe("success");
		expect(result.strategy).toBe("vector_only");
		expect(result.queryId).toBe("test-vector-only");
		expect(result.data).toHaveLength(2);
		expect(result.rowCount).toBe(2);
		expect(result.metadata.steps).toHaveLength(2); // QueryAnalysis, VectorSearch
		expect(result.metadata.vectorSearchCount).toBe(2);
		expect(result.data![0]!._score).toBeDefined();
		expect(result.data![0]!._matchedField).toBeDefined();
	});

	test("execute should handle hybrid workflow successfully", async () => {
		// Mock query analysis result for hybrid strategy
		mockApiCaller.queryAnalyzer.analyze.mockResolvedValue({
			success: true,
			analysis: {
				queryId: "test-hybrid",
				originalQuery: "Show recent orders for companies similar to Tesla",
				timestamp: new Date().toISOString(),
				feasibility: { isFeasible: true },
				clarity: { isClear: true },
				routing: {
					strategy: "hybrid",
					reason: "Requires both semantic search and structured data",
					confidence: 0.88,
				},
				sqlConfig: {
					tables: ["orders", "companies"],
					canUseFuzzySearch: false,
					estimatedComplexity: "complex",
				},
				vectorConfig: {
					queries: [
						{
							text: "Tesla similar companies",
							table: "companies",
							field: "description",
							limit: 5,
						},
					],
				},
			},
			executionTime: 120,
		});

		// Mock vector search
		mockApiCaller.vectorSearch.search.mockResolvedValue({
			success: true,
			result: {
				results: [
					{
						id: 1,
						score: 0.92,
						table: "companies",
						matchedField: "description",
						payload: { id: 1, name: "Tesla" },
						rank: 1,
					},
					{
						id: 2,
						score: 0.85,
						table: "companies",
						matchedField: "description",
						payload: { id: 2, name: "Rivian" },
						rank: 2,
					},
				],
				searchTime: 60,
				totalResults: 2,
			},
			executionTime: 150,
		});

		// Mock schema selection
		mockApiCaller.schemaSelector.select.mockResolvedValue({
			success: true,
			result: {
				slimSchema: {
					orders: {
						properties: {
							id: { type: "INTEGER", nullable: false },
							company_id: { type: "INTEGER", nullable: false },
							created_at: { type: "TIMESTAMP", nullable: true },
						},
					},
				},
				selectedTables: [
					{
						tableName: "orders",
						fields: ["id", "company_id", "created_at"],
						reason: "Contains order data",
					},
				],
				sqlHints: {
					vectorIds: [1, 2],
				},
			},
			executionTime: 70,
		});

		// Mock SQL building
		mockApiCaller.sqlBuilder.build.mockResolvedValue({
			success: true,
			result: {
				sql: "SELECT * FROM orders WHERE company_id IN (1, 2) ORDER BY created_at DESC",
				queryType: "SELECT",
				estimatedRows: "few",
				usesIndex: true,
				warnings: [],
			},
			executionTime: 90,
		});

		// Mock SQL execution
		mockApiCaller.sqlExecutor.execute.mockResolvedValue({
			success: true,
			result: {
				rows: [
					{ id: 101, company_id: 1, created_at: "2024-05-20" },
					{ id: 102, company_id: 2, created_at: "2024-05-18" },
				],
				rowCount: 2,
				columns: ["id", "company_id", "created_at"],
				truncated: false,
			},
			executionTime: 110,
		});

		// Mock result fusion
		mockApiCaller.resultFusion.fuse.mockResolvedValue({
			success: true,
			results: [
				{
					id: 1,
					source: "fusion",
					relevanceScore: 0.95,
					data: {
						id: 101,
						company_id: 1,
						company_name: "Tesla",
						created_at: "2024-05-20",
					},
				},
				{
					id: 2,
					source: "fusion",
					relevanceScore: 0.88,
					data: {
						id: 102,
						company_id: 2,
						company_name: "Rivian",
						created_at: "2024-05-18",
					},
				},
			],
			count: 2,
			executionTime: 130,
		});

		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			query: "Show recent orders for companies similar to Tesla",
			databaseSchema: JSON.stringify({
				orders: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						company_id: { type: "INTEGER", nullable: false },
						created_at: { type: "TIMESTAMP", nullable: true },
					},
				},
				companies: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						description: { type: "TEXT", nullable: true },
					},
				},
			}),
			vectorizedFields: {
				companies: ["description"],
			},
		});

		expect(result.status).toBe("success");
		expect(result.strategy).toBe("hybrid");
		expect(result.queryId).toBe("test-hybrid");
		expect(result.data).toHaveLength(2);
		expect(result.rowCount).toBe(2);
		expect(result.metadata.steps).toHaveLength(6); // All steps including fusion
		expect(result.metadata.vectorSearchCount).toBe(2);
		expect(result.metadata.fusionMethod).toBe("ai_intelligent");
	});

	test("execute should handle rejected queries appropriately", async () => {
		// Mock query analysis result for rejected strategy
		mockApiCaller.queryAnalyzer.analyze.mockResolvedValue({
			success: true,
			analysis: {
				queryId: "test-rejected",
				originalQuery: "What is the meaning of life?",
				timestamp: new Date().toISOString(),
				feasibility: {
					isFeasible: false,
					reason: "Query is not related to database content",
					suggestedAlternatives: [
						"Try asking about your data",
						"Use specific table or field names",
					],
				},
				clarity: { isClear: true },
				routing: {
					strategy: "rejected",
					reason: "Query cannot be answered with available data",
					confidence: 0.99,
				},
			},
			executionTime: 80,
		});

		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			query: "What is the meaning of life?",
			databaseSchema: JSON.stringify({
				companies: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
					},
				},
			}),
		});

		expect(result.status).toBe("failed");
		expect(result.strategy).toBe("rejected");
		expect(result.queryId).toBe("test-rejected");
		expect(result.error).toBe("Query is not related to database content");
		expect(result.suggestions).toHaveLength(2);
		expect(result.metadata.steps).toHaveLength(1); // Only QueryAnalysis
	});

	test(
		"execute should handle workflow errors gracefully",
		withSuppressedConsoleError(async () => {
			// Mock query analysis to succeed
			mockApiCaller.queryAnalyzer.analyze.mockResolvedValue({
				success: true,
				analysis: {
					queryId: "test-error",
					originalQuery: "Show all data",
					timestamp: new Date().toISOString(),
					feasibility: { isFeasible: true },
					clarity: { isClear: true },
					routing: {
						strategy: "sql_only",
						reason: "Simple query",
						confidence: 0.9,
					},
					sqlConfig: {
						tables: ["test_table"],
						canUseFuzzySearch: false,
						estimatedComplexity: "simple",
					},
				},
				executionTime: 100,
			});

			// Mock schema selection to fail
			mockApiCaller.schemaSelector.select.mockReset();
			mockApiCaller.schemaSelector.select.mockImplementation(() =>
				Promise.reject(new Error("Database connection failed")),
			);

			const caller = workflowOrchestratorRouter.createCaller(
				createTestContext(),
			);
			const result = await caller.execute({
				query: "Show all data",
				databaseSchema: JSON.stringify({
					test_table: {
						properties: {
							id: { type: "INTEGER", nullable: false },
						},
					},
				}),
			});

			expect(result.status).toBe("failed");
			expect(result.strategy).toBe("sql_only");
			expect(result.error).toContain("Database connection failed");
			expect(result.metadata.steps).toHaveLength(2); // QueryAnalysis + Failed step
			expect(result.metadata.steps[1]!.status).toBe("failed");
		}),
	);

	test("execute should respect workflow options", async () => {
		// Mock successful SQL-only workflow
		mockApiCaller.queryAnalyzer.analyze.mockResolvedValue({
			success: true,
			analysis: {
				queryId: "test-options",
				originalQuery: "Show data",
				timestamp: new Date().toISOString(),
				feasibility: { isFeasible: true },
				clarity: { isClear: true },
				routing: {
					strategy: "sql_only",
					reason: "Simple query",
					confidence: 0.9,
				},
				sqlConfig: {
					tables: ["test_table"],
					canUseFuzzySearch: false,
					estimatedComplexity: "simple",
				},
			},
			executionTime: 100,
		});

		mockApiCaller.schemaSelector.select.mockResolvedValue({
			success: true,
			result: {
				slimSchema: { test_table: { properties: {} } },
				selectedTables: [],
				sqlHints: {},
			},
			executionTime: 50,
		});

		mockApiCaller.sqlBuilder.build.mockResolvedValue({
			success: true,
			result: {
				sql: "SELECT * FROM test_table",
				queryType: "SELECT",
				estimatedRows: "few",
				usesIndex: true,
				warnings: [],
			},
			executionTime: 60,
		});

		mockApiCaller.sqlExecutor.execute.mockResolvedValue({
			success: true,
			result: {
				rows: [],
				rowCount: 0,
				columns: [],
				truncated: false,
			},
			executionTime: 80,
		});

		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		await caller.execute({
			query: "Show data",
			databaseSchema: JSON.stringify({}),
			options: {
				maxRows: 50,
				timeout: 10000,
				enableCache: true,
			},
		});

		// Verify SQL executor was called with correct maxRows
		expect(mockApiCaller.sqlExecutor.execute).toHaveBeenCalledWith(
			expect.objectContaining({
				maxRows: 50,
			}),
		);
	});

	test("getDefinition should return workflow definition", async () => {
		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		const result = await caller.getDefinition();

		expect(result.name).toBe("Text2SQL Workflow");
		expect(result.version).toBe("2.0.0");
		expect(result.steps).toHaveLength(6);
		expect(result.flows).toHaveLength(3);
		expect(result.deployment.platform).toBe("CloudFlare Workers");

		// Verify flow definitions
		const sqlOnlyFlow = result.flows.find((f) => f.strategy === "sql_only");
		expect(sqlOnlyFlow?.steps).toEqual([
			"query-analysis",
			"schema-selection",
			"sql-building",
			"sql-execution",
		]);

		const vectorOnlyFlow = result.flows.find(
			(f) => f.strategy === "vector_only",
		);
		expect(vectorOnlyFlow?.steps).toEqual(["query-analysis", "vector-search"]);

		const hybridFlow = result.flows.find((f) => f.strategy === "hybrid");
		expect(hybridFlow?.steps).toEqual([
			"query-analysis",
			"vector-search",
			"schema-selection",
			"sql-building",
			"sql-execution",
			"result-fusion",
		]);
	});

	test("getStatus should return workflow status", async () => {
		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		const result = await caller.getStatus({
			queryId: "test-query-123",
		});

		expect(result.queryId).toBe("test-query-123");
		expect(result.status).toBe("completed");
		expect(result.startTime).toBeDefined();
		expect(result.endTime).toBeDefined();
		expect(result.steps).toHaveLength(1);
		expect(result.steps[0]!.name).toBe("QueryAnalysis");
		expect(result.steps[0]!.status).toBe("success");
		expect(result.steps[0]!.duration).toBe(150);
	});

	test("execute should handle empty vector results in hybrid workflow", async () => {
		// Mock query analysis for hybrid
		mockApiCaller.queryAnalyzer.analyze.mockResolvedValue({
			success: true,
			analysis: {
				queryId: "test-empty-vector",
				originalQuery: "Test query",
				timestamp: new Date().toISOString(),
				feasibility: { isFeasible: true },
				clarity: { isClear: true },
				routing: {
					strategy: "hybrid",
					reason: "Hybrid search required",
					confidence: 0.85,
				},
				sqlConfig: {
					tables: ["test_table"],
					canUseFuzzySearch: false,
					estimatedComplexity: "simple",
				},
				vectorConfig: {
					queries: [
						{
							text: "test query",
							table: "test_table",
							field: "description",
							limit: 5,
						},
					],
				},
			},
			executionTime: 100,
		});

		// Mock empty vector search result
		mockApiCaller.vectorSearch.search.mockResolvedValue({
			success: true,
			result: {
				results: [],
				searchTime: 30,
				totalResults: 0,
			},
			executionTime: 100,
		});

		// Mock rest of the workflow
		mockApiCaller.schemaSelector.select.mockResolvedValue({
			success: true,
			result: {
				slimSchema: { test_table: { properties: {} } },
				selectedTables: [],
				sqlHints: {},
			},
			executionTime: 50,
		});

		mockApiCaller.sqlBuilder.build.mockResolvedValue({
			success: true,
			result: {
				sql: "SELECT * FROM test_table",
				queryType: "SELECT",
				estimatedRows: "few",
				usesIndex: true,
				warnings: [],
			},
			executionTime: 60,
		});

		mockApiCaller.sqlExecutor.execute.mockResolvedValue({
			success: true,
			result: {
				rows: [{ id: 1, name: "test" }],
				rowCount: 1,
				columns: ["id", "name"],
				truncated: false,
			},
			executionTime: 80,
		});

		mockApiCaller.resultFusion.fuse.mockResolvedValue({
			success: true,
			results: [
				{
					id: 1,
					source: "sql",
					relevanceScore: 1.0,
					data: { id: 1, name: "test" },
				},
			],
			count: 1,
			executionTime: 50,
		});

		const caller = workflowOrchestratorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			query: "Test query",
			databaseSchema: JSON.stringify({
				test_table: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
					},
				},
			}),
			vectorizedFields: { test_table: ["description"] },
		});

		expect(result.status).toBe("success");
		expect(result.strategy).toBe("hybrid");
		expect(result.metadata.vectorSearchCount).toBe(0);
		expect(result.metadata.fusionMethod).toBe("ai_intelligent");
	});
});
