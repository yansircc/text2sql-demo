import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { schemaSelectorRouter } from "../schema-selector";
import { correctSchemaSelectorMock } from "./correct-mock-data";
import { createTestContext, withSuppressedConsoleError } from "./test-helpers";

// Create mock function
const mockGenerateObject = jest.fn(() => Promise.resolve({ object: {} }));

// Create error mock that we can control per test
const errorMock = new Error("AI service unavailable");
let shouldThrow = false;

// Mock the AI SDK
mock.module("ai", () => ({
	generateObject: jest.fn(() => {
		if (shouldThrow) {
			shouldThrow = false; // Reset for next test
			return Promise.reject(errorMock);
		}
		return mockGenerateObject();
	}),
}));

mock.module("@ai-sdk/openai", () => ({
	createOpenAI: jest.fn(() => {
		return jest.fn((model) => ({
			modelId: model,
			provider: "openai",
		}));
	}),
}));

describe("schemaSelectorRouter", () => {
	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();
	});

	test("select should choose relevant tables and fields for simple query", async () => {
		mockGenerateObject.mockResolvedValue({
			object: correctSchemaSelectorMock.simple,
		});

		const caller = schemaSelectorRouter.createCaller(createTestContext());
		const result = await caller.select({
			query: "Show orders from last month",
			sqlConfig: {
				tables: ["orders"],
				canUseFuzzySearch: false,
				estimatedComplexity: "simple" as const,
			},
			fullSchema: JSON.stringify({
				orders: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						customer_id: { type: "INTEGER", nullable: true },
						total: { type: "DECIMAL", nullable: true },
						created_at: { type: "TIMESTAMP", nullable: true },
					},
				},
			}),
		});

		expect(result.success).toBe(true);
		expect(mockGenerateObject).toHaveBeenCalledTimes(1);
		expect(result.result.selectedTables).toEqual(
			correctSchemaSelectorMock.simple.selectedTables,
		);
		expect(result.result.sqlHints).toEqual(
			correctSchemaSelectorMock.simple.sqlHints,
		);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	test("select should handle multi-table joins", async () => {
		mockGenerateObject.mockResolvedValue({
			object: correctSchemaSelectorMock.multiTable,
		});

		const caller = schemaSelectorRouter.createCaller(createTestContext());
		const result = await caller.select({
			query: "Show orders with customer names from last month",
			sqlConfig: {
				tables: ["orders", "customers"],
				canUseFuzzySearch: true,
				fuzzyPatterns: ["customer name"],
				estimatedComplexity: "moderate" as const,
			},
			fullSchema: JSON.stringify({
				orders: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						customer_id: { type: "INTEGER", nullable: true },
						total: { type: "DECIMAL", nullable: true },
						created_at: { type: "TIMESTAMP", nullable: true },
					},
				},
				customers: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						email: { type: "TEXT", nullable: true },
					},
				},
			}),
		});

		expect(result.result.selectedTables).toHaveLength(2);
		expect(result.result.sqlHints.joinHints).toBeDefined();
		expect(result.result.sqlHints.joinHints?.[0]?.type).toBe("LEFT");
		expect(result.result.sqlHints.indexedFields).toContain("orders.id");
	});

	test("select should handle vector context for hybrid queries", async () => {
		mockGenerateObject.mockResolvedValue({
			object: correctSchemaSelectorMock.withVectorContext,
		});

		const caller = schemaSelectorRouter.createCaller(createTestContext());
		const result = await caller.select({
			query: "Show recent orders for companies similar to Tesla",
			sqlConfig: {
				tables: ["companies", "orders"],
				canUseFuzzySearch: false,
				estimatedComplexity: "complex" as const,
			},
			fullSchema: JSON.stringify({
				companies: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						name: { type: "TEXT", nullable: true },
						industry: { type: "TEXT", nullable: true },
						description: { type: "TEXT", nullable: true },
					},
				},
				orders: {
					properties: {
						id: { type: "INTEGER", nullable: false },
						company_id: { type: "INTEGER", nullable: true },
						total: { type: "DECIMAL", nullable: true },
						created_at: { type: "TIMESTAMP", nullable: true },
					},
				},
			}),
			vectorContext: {
				hasResults: true,
				ids: [1, 2, 3],
				topMatches: [
					{
						id: 1,
						score: 0.95,
						matchedField: "description",
					},
					{
						id: 2,
						score: 0.85,
						matchedField: "industry",
					},
				],
			},
		});

		expect(result.result.selectedTables).toHaveLength(2);
		expect(result.result.sqlHints.joinHints?.[0]?.from).toBe("orders");
		expect(result.result.sqlHints.joinHints?.[0]?.to).toBe("companies");
		expect(result.result.compressionRatio).toBeGreaterThan(0);
	});

	test(
		"select should handle errors gracefully",
		withSuppressedConsoleError(async () => {
			// Set flag to throw error
			shouldThrow = true;

			const caller = schemaSelectorRouter.createCaller(createTestContext());

			await expect(
				caller.select({
					query: "Show orders",
					sqlConfig: {
						tables: ["orders"],
						canUseFuzzySearch: false,
						estimatedComplexity: "simple" as const,
					},
					fullSchema: JSON.stringify({
						orders: {
							properties: {
								id: { type: "INTEGER", nullable: false },
							},
						},
					}),
				}),
			).rejects.toThrow("Schema选择失败");
		}),
	);
});
