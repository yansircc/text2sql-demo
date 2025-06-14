import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { vectorSearchRouter } from "../vector-search";
import { createTestContext, withSuppressedConsoleError } from "./test-helpers";

// Create mock functions
const mockEmbedText = jest.fn(() => Promise.resolve([0.1, 0.2, 0.3, 0.4]));

// Create error mock that we can control per test
const embedErrorMock = new Error("Embedding failed");
let shouldEmbedThrow = false;

const mockQdrantService = {
	search: jest.fn<any>(() => Promise.resolve([])),
	searchBatch: jest.fn<any>(() => Promise.resolve([])),
	collectionExists: jest.fn<any>(() => Promise.resolve(true)),
	getClient: jest.fn(() => ({
		getCollection: jest.fn(() =>
			Promise.resolve({
				config: {
					params: {
						vectors: {
							description: { size: 384, distance: "Cosine" },
							mission: { size: 384, distance: "Cosine" },
							name: { size: 384, distance: "Cosine" },
						},
					},
				},
			}),
		),
	})),
};

// Mock dependencies
mock.module("@/lib/embed-text", () => ({
	embedText: jest.fn(() => {
		if (shouldEmbedThrow) {
			shouldEmbedThrow = false; // Reset for next test
			return Promise.reject(embedErrorMock);
		}
		return mockEmbedText();
	}),
}));

mock.module("@/lib/qdrant/service", () => ({
	qdrantService: mockQdrantService,
}));

describe("vectorSearchRouter", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
		// Set default mock behavior
		mockQdrantService.collectionExists.mockResolvedValue(true);
		mockQdrantService.search.mockResolvedValue([]);
		// Reset getClient to default mock
		mockQdrantService.getClient.mockReturnValue({
			getCollection: jest.fn(() =>
				Promise.resolve({
					config: {
						params: {
							vectors: {
								description: { size: 384, distance: "Cosine" },
								mission: { size: 384, distance: "Cosine" },
								name: { size: 384, distance: "Cosine" },
							},
						},
					},
				}),
			),
		});
	});

	test("search should perform vector search on single table", async () => {
		const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
		const mockSearchResults = [
			{
				id: 1,
				score: 0.95,
				payload: {
					companyId: 1,
					name: "Tesla",
					description: "Electric vehicle manufacturer",
				},
			},
			{
				id: 2,
				score: 0.85,
				payload: {
					companyId: 2,
					name: "Rivian",
					description: "Electric truck company",
				},
			},
		];

		mockEmbedText.mockResolvedValue(mockEmbedding);
		mockQdrantService.search.mockResolvedValue(mockSearchResults);

		const caller = vectorSearchRouter.createCaller(createTestContext());
		const result = await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["description"],
					searchText: "electric vehicles",
					limit: 10,
				},
			],
			hnswEf: 128,
		});

		expect(mockEmbedText).toHaveBeenCalledTimes(1);
		expect(mockQdrantService.search).toHaveBeenCalledWith(
			"zetar-demo-companies",
			expect.objectContaining({
				vectorName: "description",
				vector: mockEmbedding,
				limit: 10,
				withPayload: true,
				withVectors: false,
				hnswEf: 128,
			}),
		);

		expect(result.success).toBe(true);
		expect(result.result.results).toHaveLength(2);
		expect(result.result.results[0]?.table).toBe("companies");
		expect(result.result.results[0]?.score).toBe(0.95);
		expect(result.result.results[0]?.payload.name).toBe("Tesla");
	});

	test("search should handle multiple tables and fields", async () => {
		const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
		const mockCompanyResults = [
			{
				id: 1,
				score: 0.9,
				payload: { companyId: 1, name: "Tesla" },
			},
		];
		const mockOrderResults = [
			{
				id: 100,
				score: 0.8,
				payload: { companyId: 100, orderId: "ORD-001" },
			},
		];

		mockEmbedText.mockResolvedValue(mockEmbedding);
		mockQdrantService.search
			.mockResolvedValueOnce(mockCompanyResults) // companies.description
			.mockResolvedValueOnce([]) // companies.mission
			.mockResolvedValueOnce(mockOrderResults); // orders.description

		const caller = vectorSearchRouter.createCaller(createTestContext());
		const result = await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["description", "mission"],
					searchText: "sustainable technology",
					limit: 5,
				},
				{
					table: "orders",
					fields: ["description"],
					searchText: "green energy products",
					limit: 5,
				},
			],
		});

		// Should embed both search texts
		expect(mockEmbedText).toHaveBeenCalledTimes(2);

		// Should search all fields
		expect(mockQdrantService.search).toHaveBeenCalledTimes(3);

		expect(result.success).toBe(true);
		expect(result.result.totalResults).toBe(2);
	});

	test("search should handle collection not found", async () => {
		mockQdrantService.collectionExists.mockResolvedValue(false);

		const caller = vectorSearchRouter.createCaller(createTestContext());
		const result = await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["description"],
					searchText: "test",
					limit: 10,
				},
			],
		});

		expect(result.success).toBe(true);
		expect(result.result.results).toHaveLength(0);
		expect(result.result.totalResults).toBe(0);
	});

	test("search should apply limit to each query", async () => {
		const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
		mockEmbedText.mockResolvedValue(mockEmbedding);

		// Return more results than limit
		const manyResults = Array(20)
			.fill(null)
			.map((_, i) => ({
				id: i,
				score: 0.9 - i * 0.01,
				payload: { companyId: i, name: `Company ${i}` },
			}));

		mockQdrantService.collectionExists.mockResolvedValue(true);
		mockQdrantService.search.mockResolvedValue(manyResults.slice(0, 5));

		const caller = vectorSearchRouter.createCaller(createTestContext());
		const result = await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["description"],
					searchText: "test",
					limit: 5,
				},
			],
		});

		expect(result.result.results).toHaveLength(5);
		expect(result.result.totalResults).toBe(5);
	});

	test("search should handle multiple fields with ranking", async () => {
		const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
		mockEmbedText.mockResolvedValue(mockEmbedding);

		mockQdrantService.collectionExists.mockResolvedValue(true);

		// Different scores for different fields
		mockQdrantService.search
			.mockResolvedValueOnce([
				{ id: 1, score: 0.95, payload: { companyId: 1, name: "Company A" } },
				{ id: 2, score: 0.75, payload: { companyId: 2, name: "Company B" } },
			])
			.mockResolvedValueOnce([
				{ id: 3, score: 0.9, payload: { companyId: 3, name: "Company C" } },
				{ id: 4, score: 0.8, payload: { companyId: 4, name: "Company D" } },
			]);

		const caller = vectorSearchRouter.createCaller(createTestContext());
		const result = await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["description", "mission"],
					searchText: "innovative",
					limit: 10,
				},
			],
		});

		expect(result.result.results).toHaveLength(4);
		expect(result.result.totalResults).toBe(4);

		// Verify proper ranking
		expect(result.result.results[0]!.score).toBe(0.95);
		expect(result.result.results[1]!.score).toBe(0.9);
		expect(result.result.results[2]!.score).toBe(0.8);
		expect(result.result.results[3]!.score).toBe(0.75);
	});

	test("search should respect limit per field", async () => {
		const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
		const mockSearchResults = Array(10)
			.fill(null)
			.map((_, i) => ({
				id: i,
				score: 0.9 - i * 0.01,
				payload: { companyId: i },
			}));

		mockEmbedText.mockResolvedValue(mockEmbedding);
		mockQdrantService.collectionExists.mockResolvedValue(true);
		mockQdrantService.search
			.mockResolvedValueOnce(mockSearchResults.slice(0, 2)) // First field: id 0,1
			.mockResolvedValueOnce(
				mockSearchResults.slice(2, 4).map((r) => ({ ...r, id: r.id + 10 })),
			); // Second field: id 12,13

		const caller = vectorSearchRouter.createCaller(createTestContext());
		const result = await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["description", "mission"],
					searchText: "test",
					limit: 2, // Limit per field
				},
			],
		});

		expect(result.result.results).toHaveLength(4); // 2 per field
		expect(result.result.totalResults).toBe(4);
	});

	test(
		"search should handle search errors gracefully",
		withSuppressedConsoleError(async () => {
			// Set flag to throw error
			shouldEmbedThrow = true;

			const caller = vectorSearchRouter.createCaller(createTestContext());

			await expect(
				caller.search({
					queries: [
						{
							table: "companies",
							fields: ["description"],
							searchText: "test",
							limit: 10,
						},
					],
				}),
			).rejects.toThrow("向量搜索失败");
		}),
	);

	test("search should skip non-vectorized fields", async () => {
		const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
		mockEmbedText.mockResolvedValue(mockEmbedding);

		// Collection exists but field is not vectorized
		mockQdrantService.collectionExists.mockResolvedValue(true);

		// Mock collection info without "name" field
		mockQdrantService.getClient.mockReturnValueOnce({
			getCollection: jest.fn(() =>
				Promise.resolve({
					config: {
						params: {
							vectors: {
								description: { size: 384, distance: "Cosine" },
								// "name" field is not vectorized
							},
						},
					},
				}),
			),
		} as any);

		const caller = vectorSearchRouter.createCaller(createTestContext());
		const result = await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["name"], // This field is not vectorized
					searchText: "test",
					limit: 10,
				},
			],
		});

		// Should not call search for non-vectorized field
		expect(mockQdrantService.search).not.toHaveBeenCalled();
		expect(result.result.results).toHaveLength(0);
	});

	test("search should handle custom hnswEf parameter", async () => {
		const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
		mockEmbedText.mockResolvedValue(mockEmbedding);
		mockQdrantService.search.mockResolvedValue([]);

		const caller = vectorSearchRouter.createCaller(createTestContext());
		await caller.search({
			queries: [
				{
					table: "companies",
					fields: ["name"],
					searchText: "test",
					limit: 10,
				},
			],
			hnswEf: 256,
		});

		expect(mockQdrantService.search).toHaveBeenCalledWith(
			"zetar-demo-companies",
			expect.objectContaining({
				hnswEf: 256,
			}),
		);
	});
});
