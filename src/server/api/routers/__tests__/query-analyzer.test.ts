import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { queryAnalyzerRouter } from "../query-analyzer";
import { QueryAnalysisSchema } from "../query-analyzer";
import { createTestContext } from "./test-helpers";
import { correctQueryAnalysisMock } from "./correct-mock-data";

// Create mock function
const mockGenerateObject = jest.fn(() => Promise.resolve({ object: {} }));

// Mock the AI SDK
mock.module("ai", () => ({
	generateObject: mockGenerateObject,
}));

mock.module("@ai-sdk/openai", () => ({
	createOpenAI: jest.fn(() => {
		return jest.fn((model) => ({
			modelId: model,
			provider: "openai",
		}));
	}),
}));

describe("queryAnalyzerRouter", () => {
	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();
	});

	test("analyze should return SQL-only strategy for structured queries", async () => {
		mockGenerateObject.mockResolvedValue({ object: correctQueryAnalysisMock.sqlOnly });

		const caller = queryAnalyzerRouter.createCaller(createTestContext());
		const result = await caller.analyze({
			query: "Show all orders from last month",
			databaseSchema: "CREATE TABLE orders (id INTEGER, created_at TIMESTAMP, total DECIMAL);",
		});

		expect(result).toEqual({
			success: true,
			analysis: correctQueryAnalysisMock.sqlOnly,
			executionTime: expect.any(Number),
		});
		expect(mockGenerateObject).toHaveBeenCalledTimes(1);
	});

	test("analyze should return vector-only strategy for semantic queries", async () => {
		mockGenerateObject.mockResolvedValue({ object: correctQueryAnalysisMock.vectorOnly });

		const caller = queryAnalyzerRouter.createCaller(createTestContext());
		const result = await caller.analyze({
			query: "Find companies working on sustainable energy",
			databaseSchema: "CREATE TABLE companies (id INTEGER, name TEXT, description TEXT, mission TEXT);",
			vectorizedFields: {
				companies: ["description", "mission"]
			},
		});

		expect(result).toEqual({
			success: true,
			analysis: correctQueryAnalysisMock.vectorOnly,
			executionTime: expect.any(Number),
		});
		expect(result.analysis.routing.strategy).toBe("vector_only");
		expect(result.analysis.vectorConfig).toBeDefined();
	});

	test("analyze should return hybrid strategy for complex queries", async () => {
		mockGenerateObject.mockResolvedValue({ object: correctQueryAnalysisMock.hybrid });

		const caller = queryAnalyzerRouter.createCaller(createTestContext());
		const result = await caller.analyze({
			query: "Show recent orders for companies similar to Tesla",
			databaseSchema: "CREATE TABLE orders (id INTEGER, created_at TIMESTAMP, company_id INTEGER); CREATE TABLE companies (id INTEGER, name TEXT, description TEXT, industry TEXT);",
			vectorizedFields: {
				companies: ["description", "industry"]
			},
		});

		expect(result).toEqual({
			success: true,
			analysis: correctQueryAnalysisMock.hybrid,
			executionTime: expect.any(Number),
		});
		expect(result.analysis.routing.strategy).toBe("hybrid");
		expect(result.analysis.sqlConfig).toBeDefined();
		expect(result.analysis.vectorConfig).toBeDefined();
	});

	test("analyze should handle infeasible queries", async () => {
		mockGenerateObject.mockResolvedValue({ object: correctQueryAnalysisMock.rejected });

		const caller = queryAnalyzerRouter.createCaller(createTestContext());
		const result = await caller.analyze({
			query: "What is the meaning of life?",
			databaseSchema: "CREATE TABLE companies (id INTEGER, name TEXT);",
		});

		expect(result).toEqual({
			success: true,
			analysis: correctQueryAnalysisMock.rejected,
			executionTime: expect.any(Number),
		});
		expect(result.analysis.routing.strategy).toBe("rejected");
		expect(result.analysis.feasibility.isFeasible).toBe(false);
	});

	test("analyze should handle unclear queries", async () => {
		mockGenerateObject.mockResolvedValue({ object: correctQueryAnalysisMock.unclear });

		const caller = queryAnalyzerRouter.createCaller(createTestContext());
		const result = await caller.analyze({
			query: "Show the data",
			databaseSchema: "CREATE TABLE companies (id INTEGER, name TEXT); CREATE TABLE orders (id INTEGER);",
		});

		expect(result).toEqual({
			success: true,
			analysis: correctQueryAnalysisMock.unclear,
			executionTime: expect.any(Number),
		});
		expect(result.analysis.clarity.isClear).toBe(false);
		expect(result.analysis.clarity.missingInfo).toHaveLength(2);
	});

	test("analyze should handle queries with fuzzy search requirements", async () => {
		const mockAnalysis = {
			queryId: "test-fuzzy",
			originalQuery: "Find company named Microsft",
			timestamp: new Date().toISOString(),
			feasibility: {
				isFeasible: true,
			},
			clarity: {
				isClear: true,
			},
			routing: {
				strategy: "sql_only" as const,
				reason: "Query needs fuzzy matching for potential typos",
				confidence: 0.88,
			},
			sqlConfig: {
				tables: ["companies"],
				canUseFuzzySearch: true,
				fuzzyPatterns: ["Microsft"],
				estimatedComplexity: "simple" as const,
			},
		};

		mockGenerateObject.mockResolvedValue({ object: mockAnalysis });

		const caller = queryAnalyzerRouter.createCaller(createTestContext());
		const result = await caller.analyze({
			query: "Find company named Microsft",
			databaseSchema: "CREATE TABLE companies (id INTEGER, name TEXT);",
		});

		expect(result).toEqual({
			success: true,
			analysis: mockAnalysis,
			executionTime: expect.any(Number),
		});
		expect(result.analysis.sqlConfig?.canUseFuzzySearch).toBe(true);
	});

	test("analyze should handle aggregation queries", async () => {
		const mockAnalysis = {
			queryId: "test-agg",
			originalQuery: "What is the total revenue by company last year?",
			timestamp: new Date().toISOString(),
			feasibility: {
				isFeasible: true,
			},
			clarity: {
				isClear: true,
			},
			routing: {
				strategy: "sql_only" as const,
				reason: "Query requires aggregation operations",
				confidence: 0.92,
			},
			sqlConfig: {
				tables: ["orders", "companies"],
				canUseFuzzySearch: false,
				estimatedComplexity: "complex" as const,
			},
		};

		mockGenerateObject.mockResolvedValue({ object: mockAnalysis });

		const caller = queryAnalyzerRouter.createCaller(createTestContext());
		const result = await caller.analyze({
			query: "What is the total revenue by company last year?",
			databaseSchema: "CREATE TABLE orders (id INTEGER, created_at TIMESTAMP, company_id INTEGER, revenue DECIMAL); CREATE TABLE companies (id INTEGER, name TEXT);",
		});

		expect(result).toEqual({
			success: true,
			analysis: mockAnalysis,
			executionTime: expect.any(Number),
		});
		expect(result.analysis.sqlConfig?.estimatedComplexity).toBe("complex");
	});
});