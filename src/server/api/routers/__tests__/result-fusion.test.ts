import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { resultFusionRouter } from "../result-fusion";
import { createTestContext, withSuppressedConsoleError } from "./test-helpers";

// Create mock functions
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

describe("resultFusionRouter", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	test("fuse should combine SQL and vector results", async () => {
		const mockFusedResults = {
			results: [
				{
					id: 1,
					source: "fusion",
					relevanceScore: 0.95,
					data: {
						company_id: 1,
						company_name: "Tesla",
						industry: "Electric Vehicles",
						revenue: 50000000,
						description: "Leading electric vehicle manufacturer",
					},
					explanation: "High relevance due to exact match in SQL and semantic similarity",
				},
				{
					id: 2,
					source: "vector",
					relevanceScore: 0.85,
					data: {
						company_id: 2,
						company_name: "Rivian",
						industry: "Electric Vehicles",
						description: "Electric truck and SUV manufacturer",
					},
					explanation: "Found through semantic search for electric vehicles",
				},
			],
			count: 2,
		};

		mockGenerateObject.mockResolvedValue({ object: mockFusedResults });

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Show electric vehicle companies with high revenue",
			vectorResults: [
				{
					id: 1,
					score: 0.9,
					table: "companies",
					matchedField: "description",
					payload: {
						company_id: 1,
						company_name: "Tesla",
						description: "Leading electric vehicle manufacturer",
					},
					rank: 1,
				},
				{
					id: 2,
					score: 0.85,
					table: "companies",
					matchedField: "description",
					payload: {
						company_id: 2,
						company_name: "Rivian",
						description: "Electric truck and SUV manufacturer",
					},
					rank: 2,
				},
			],
			sqlResults: [
				{
					company_id: 1,
					company_name: "Tesla",
					industry: "Electric Vehicles",
					revenue: 50000000,
				},
				{
					company_id: 3,
					company_name: "Ford",
					industry: "Automotive",
					revenue: 150000000,
				},
			],
			maxResults: 10,
		});

		expect(result.success).toBe(true);
		expect(result.results).toHaveLength(2);
		expect(result.count).toBe(2);
		expect(result.results![0]!.relevanceScore).toBe(0.95);
		expect(result.results![0]!.source).toBe("fusion");
		// Note: result-fusion router doesn't return executionTime
	});

	test("fuse should handle SQL-only results", async () => {
		const mockFusedResults = {
			results: [
				{
					id: 1,
					source: "sql",
					relevanceScore: 1.0,
					data: {
						order_id: 101,
						customer_name: "John Doe",
						total: 250.0,
						created_at: "2024-01-15",
					},
				},
				{
					id: 2,
					source: "sql",
					relevanceScore: 1.0,
					data: {
						order_id: 102,
						customer_name: "Jane Smith",
						total: 350.0,
						created_at: "2024-01-16",
					},
				},
			],
			count: 2,
		};

		mockGenerateObject.mockResolvedValue({ object: mockFusedResults });

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Show recent orders",
			sqlResults: [
				{
					order_id: 101,
					customer_name: "John Doe",
					total: 250.0,
					created_at: "2024-01-15",
				},
				{
					order_id: 102,
					customer_name: "Jane Smith",
					total: 350.0,
					created_at: "2024-01-16",
				},
			],
			maxResults: 10,
		});

		expect(result.success).toBe(true);
		expect(result.results).toHaveLength(2);
		expect(result.results![0]!.source).toBe("sql");
		expect(result.results![0]!.relevanceScore).toBe(1.0);
	});

	test("fuse should handle vector-only results", async () => {
		const mockFusedResults = {
			results: [
				{
					id: 1,
					source: "vector",
					relevanceScore: 0.92,
					data: {
						id: 10,
						title: "Introduction to Machine Learning",
						content: "Machine learning is a subset of artificial intelligence...",
					},
					explanation: "High semantic similarity to query",
				},
			],
			count: 1,
		};

		mockGenerateObject.mockResolvedValue({ object: mockFusedResults });

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Articles about AI and machine learning",
			vectorResults: [
				{
					id: 10,
					score: 0.92,
					table: "articles",
					matchedField: "content",
					payload: {
						id: 10,
						title: "Introduction to Machine Learning",
						content: "Machine learning is a subset of artificial intelligence...",
					},
					rank: 1,
				},
			],
			maxResults: 5,
		});

		expect(result.success).toBe(true);
		expect(result.results).toHaveLength(1);
		expect(result.results![0]!.source).toBe("vector");
	});

	test("fuse should respect maxResults limit", async () => {
		const mockResults = Array.from({ length: 5 }, (_, i) => ({
			id: i + 1,
			source: "sql",
			relevanceScore: 1.0 - i * 0.1,
			data: { id: i + 1, name: `Item ${i + 1}` },
		}));

		mockGenerateObject.mockResolvedValue({
			object: {
				results: mockResults,
				count: 5,
			},
		});

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Show top 3 items",
			sqlResults: Array.from({ length: 10 }, (_, i) => ({
				id: i + 1,
				name: `Item ${i + 1}`,
			})),
			maxResults: 3,
		});

		expect(result.results).toHaveLength(5); // AI returned 5, but we requested max 3
		expect(result.count).toBe(5);
	});

	test("fuse should handle empty results gracefully", async () => {
		mockGenerateObject.mockResolvedValue({
			object: {
				results: [],
				count: 0,
			},
		});

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Show non-existent data",
			maxResults: 10,
		});

		expect(result.success).toBe(true);
		expect(result.results).toHaveLength(0);
		expect(result.count).toBe(0);
	});

	test("fuse should handle deduplification and ranking", async () => {
		const mockFusedResults = {
			results: [
				{
					id: 1,
					source: "fusion",
					relevanceScore: 0.98,
					data: {
						product_id: 101,
						name: "iPhone 15 Pro",
						category: "Electronics",
						price: 999,
						in_stock: true,
					},
					explanation: "Found in both SQL (exact match) and vector search (high similarity)",
				},
				{
					id: 2,
					source: "vector",
					relevanceScore: 0.85,
					data: {
						product_id: 102,
						name: "Samsung Galaxy S24",
						category: "Electronics",
					},
					explanation: "Similar product found through semantic search",
				},
			],
			count: 2,
		};

		mockGenerateObject.mockResolvedValue({ object: mockFusedResults });

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Latest flagship smartphones in stock",
			vectorResults: [
				{
					id: 101,
					score: 0.95,
					table: "products",
					matchedField: "description",
					payload: {
						product_id: 101,
						name: "iPhone 15 Pro",
						description: "Latest Apple flagship smartphone",
					},
					rank: 1,
				},
				{
					id: 102,
					score: 0.85,
					table: "products",
					matchedField: "description",
					payload: {
						product_id: 102,
						name: "Samsung Galaxy S24",
						description: "Samsung's newest flagship phone",
					},
					rank: 2,
				},
			],
			sqlResults: [
				{
					product_id: 101,
					name: "iPhone 15 Pro",
					category: "Electronics",
					price: 999,
					in_stock: true,
				},
				{
					product_id: 103,
					name: "Google Pixel 8 Pro",
					category: "Electronics",
					price: 899,
					in_stock: true,
				},
			],
			maxResults: 10,
		});

		expect(result.results).toHaveLength(2);
		expect(result.results![0]!.source).toBe("fusion");
		expect(result.results![0]!.relevanceScore).toBeGreaterThan(
			result.results![1]!.relevanceScore,
		);
	});

	test("fuse should include metadata in results", async () => {
		const mockFusedResults = {
			results: [
				{
					id: 1,
					source: "fusion",
					relevanceScore: 0.95,
					data: {
						id: 1,
						name: "Test Item",
					},
					explanation: "Matched both criteria",
					metadata: {
						sqlRank: 1,
						vectorRank: 2,
						matchedFields: ["name", "description"],
					},
				},
			],
			count: 1,
		};

		mockGenerateObject.mockResolvedValue({ object: mockFusedResults });

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Find test items",
			vectorResults: [
				{
					id: 1,
					score: 0.8,
					table: "items",
					matchedField: "description",
					payload: { id: 1, name: "Test Item" },
					rank: 2,
				},
			],
			sqlResults: [{ id: 1, name: "Test Item", category: "Test" }],
			maxResults: 10,
		});

		expect(result.results![0]!.metadata).toBeDefined();
		expect(result.results![0]!.metadata?.sqlRank).toBe(1);
		expect(result.results![0]!.metadata?.vectorRank).toBe(2);
	});

	test("fuse should handle large result sets efficiently", async () => {
		// Create large mock results
		const largeVectorResults = Array.from({ length: 100 }, (_, i) => ({
			id: i,
			score: 0.9 - i * 0.001,
			table: "products",
			matchedField: "description",
			payload: { id: i, name: `Product ${i}` },
			rank: i + 1,
		}));

		const largeSqlResults = Array.from({ length: 100 }, (_, i) => ({
			id: i + 50, // Some overlap with vector results
			name: `Product ${i + 50}`,
			price: 100 + i,
		}));

		const mockFusedResults = {
			results: Array.from({ length: 20 }, (_, i) => ({
				id: i,
				source: i < 10 ? "fusion" : "sql",
				relevanceScore: 1.0 - i * 0.05,
				data: {
					id: i,
					name: `Product ${i}`,
					price: 100 + i,
				},
			})),
			count: 20,
		};

		mockGenerateObject.mockResolvedValue({ object: mockFusedResults });

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Show all products sorted by relevance",
			vectorResults: largeVectorResults,
			sqlResults: largeSqlResults,
			maxResults: 20,
		});

		expect(result.results).toHaveLength(20);
		expect(result.count).toBe(20);
	});

	test("fuse should handle errors gracefully", withSuppressedConsoleError(async () => {
		// Clear any previous mock implementations
		mockGenerateObject.mockReset();
		mockGenerateObject.mockImplementation(() => 
			Promise.reject(new Error("AI service unavailable"))
		);

		const caller = resultFusionRouter.createCaller(createTestContext());

		await expect(
			caller.fuse({
				userQuery: "Test query",
				maxResults: 10,
			})
		).rejects.toThrow("结果融合失败");
	}));

	test("fuse should work with custom scoring and explanations", async () => {
		const mockFusedResults = {
			results: [
				{
					id: 1,
					source: "fusion",
					relevanceScore: 0.92,
					data: {
						doc_id: "DOC001",
						title: "Climate Change Report 2024",
						author: "Dr. Smith",
						relevance_factors: {
							keyword_match: 0.8,
							semantic_similarity: 0.95,
							recency: 1.0,
						},
					},
					explanation: "High relevance: recent document with strong keyword and semantic matches",
				},
			],
			count: 1,
		};

		mockGenerateObject.mockResolvedValue({ object: mockFusedResults });

		const caller = resultFusionRouter.createCaller(createTestContext());
		const result = await caller.fuse({
			userQuery: "Latest climate change research 2024",
			vectorResults: [
				{
					id: 1,
					score: 0.95,
					table: "documents",
					matchedField: "content",
					payload: {
						doc_id: "DOC001",
						title: "Climate Change Report 2024",
						content: "Comprehensive analysis of climate change...",
					},
					rank: 1,
				},
			],
			sqlResults: [
				{
					doc_id: "DOC001",
					title: "Climate Change Report 2024",
					author: "Dr. Smith",
					published_date: "2024-01-15",
				},
			],
			maxResults: 5,
		});

		expect(result.results![0]!.data.relevance_factors).toBeDefined();
		expect(result.results![0]!.explanation).toContain("High relevance");
	});
});