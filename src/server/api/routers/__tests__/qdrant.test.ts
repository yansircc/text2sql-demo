import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { qdrantRouter } from "../qdrant";
import { createTestContext } from "./test-helpers";

// Create mock functions
const mockQdrantService = {
	listCollections: jest.fn(),
	getCollection: jest.fn(),
	createCollection: jest.fn(),
	deleteCollection: jest.fn(),
	createPayloadIndex: jest.fn(),
	upsertPoints: jest.fn(),
	deletePoints: jest.fn(),
	deletePointsByDocumentId: jest.fn(),
	retrievePoints: jest.fn(),
	search: jest.fn(),
	searchBatch: jest.fn(),
};

// Mock the qdrantService module
mock.module("@/lib/qdrant/service", () => ({
	qdrantService: mockQdrantService,
}));

describe("qdrantRouter", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	test("listCollections should return collections", async () => {
		const mockCollections = [
			{ name: "collection1", vectors_count: 100 },
			{ name: "collection2", vectors_count: 200 },
		];
		mockQdrantService.listCollections.mockResolvedValue(mockCollections);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.listCollections();

		expect(result).toEqual(mockCollections);
		expect(mockQdrantService.listCollections).toHaveBeenCalledTimes(1);
	});

	test("getCollection should return collection details", async () => {
		const mockCollection = {
			status: "green" as const,
			optimizer_status: "ok" as const,
			vectors_count: 100,
			indexed_vectors_count: 100,
			points_count: 100,
			segments_count: 1,
			config: {
				params: {
					vectors: {
						size: 384,
						distance: "Cosine" as const,
					},
				},
				hnsw_config: {
					m: 16,
					ef_construct: 200,
					full_scan_threshold: 10000,
				},
				optimizer_config: {
					deleted_threshold: 0.2,
					vacuum_min_vector_number: 1000,
					default_segment_number: 0,
					max_segment_size: 200000,
					memmap_threshold: 50000,
					indexing_threshold: 20000,
					flush_interval_sec: 5,
					max_optimization_threads: 1,
				},
			},
			payload_schema: {},
		};
		mockQdrantService.getCollection.mockResolvedValue(mockCollection as any);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.getCollection({
			collectionName: "test-collection",
		});

		expect(result).toEqual(mockCollection);
		expect(mockQdrantService.getCollection).toHaveBeenCalledWith(
			"test-collection",
		);
	});

	test("createCollection should create a new collection", async () => {
		const mockResponse = true;
		mockQdrantService.createCollection.mockResolvedValue(mockResponse);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.createCollection({
			collectionName: "new-collection",
			config: {
				vectors: {
					title: { size: 384, distance: "Cosine" },
					content: { size: 768, distance: "Cosine" },
				},
			},
		});

		expect(result).toEqual(mockResponse);
		expect(mockQdrantService.createCollection).toHaveBeenCalledWith(
			"new-collection",
			{
				vectors: {
					title: { size: 384, distance: "Cosine" },
					content: { size: 768, distance: "Cosine" },
				},
			},
		);
	});

	test("deleteCollection should delete a collection", async () => {
		const mockResponse = true;
		mockQdrantService.deleteCollection.mockResolvedValue(mockResponse);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.deleteCollection({
			collectionName: "old-collection",
		});

		expect(result).toEqual(mockResponse);
		expect(mockQdrantService.deleteCollection).toHaveBeenCalledWith(
			"old-collection",
		);
	});

	test("createPayloadIndex should create an index", async () => {
		const mockResponse = { operation_id: 123, status: "acknowledged" as const };
		mockQdrantService.createPayloadIndex.mockResolvedValue(mockResponse);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.createPayloadIndex({
			collectionName: "test-collection",
			options: {
				field_name: "document_id",
				field_schema: "keyword",
			},
		});

		expect(result).toEqual(mockResponse);
		expect(mockQdrantService.createPayloadIndex).toHaveBeenCalledWith(
			"test-collection",
			{
				field_name: "document_id",
				field_schema: "keyword",
			},
		);
	});

	test("upsertPoints should insert/update points", async () => {
		const mockResponse = { operation_id: 123, status: "acknowledged" as const };
		mockQdrantService.upsertPoints.mockResolvedValue(mockResponse);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.upsertPoints({
			collectionName: "test-collection",
			points: [
				{
					id: "point-1",
					vectors: {
						title: [0.1, 0.2, 0.3],
						content: [0.4, 0.5, 0.6],
					},
					payload: { text: "test content" },
				},
			],
		});

		expect(result).toEqual(mockResponse);
		expect(mockQdrantService.upsertPoints).toHaveBeenCalledWith(
			"test-collection",
			[
				{
					id: "point-1",
					vectors: {
						title: [0.1, 0.2, 0.3],
						content: [0.4, 0.5, 0.6],
					},
					payload: { text: "test content" },
				},
			],
			undefined,
		);
	});

	test("deletePoints should delete points by IDs", async () => {
		const mockResponse = { operation_id: 123, status: "acknowledged" as const };
		mockQdrantService.deletePoints.mockResolvedValue(mockResponse);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.deletePoints({
			collectionName: "test-collection",
			pointIds: ["point-1", "point-2"],
		});

		expect(result).toEqual(mockResponse);
		expect(mockQdrantService.deletePoints).toHaveBeenCalledWith(
			"test-collection",
			["point-1", "point-2"],
			undefined,
		);
	});

	test("deletePointsByDocumentId should delete points by document ID", async () => {
		const mockResponse = { operation_id: 123, status: "acknowledged" as const };
		// Note: deletePointsByDocumentId internally calls deletePoints with a filter
		mockQdrantService.deletePoints.mockResolvedValue(mockResponse);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.deletePointsByDocumentId({
			collectionName: "test-collection",
			documentId: "doc-123",
		});

		expect(result).toEqual(mockResponse);
		expect(mockQdrantService.deletePoints).toHaveBeenCalledWith(
			"test-collection",
			{
				filter: {
					must: [
						{
							key: "documentId",
							match: {
								value: "doc-123",
							},
						},
					],
				},
			},
			undefined,
		);
	});

	test("retrievePoints should retrieve points by IDs", async () => {
		const mockPoints = [
			{ id: "point-1", payload: { text: "content 1" }, vectors: {} },
			{ id: "point-2", payload: { text: "content 2" }, vectors: {} },
		];
		mockQdrantService.retrievePoints.mockResolvedValue(mockPoints);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.retrievePoints({
			collectionName: "test-collection",
			pointIds: ["point-1", "point-2"],
		});

		expect(result).toEqual(mockPoints);
		expect(mockQdrantService.retrievePoints).toHaveBeenCalledWith(
			"test-collection",
			["point-1", "point-2"],
		);
	});

	test("search should perform vector search", async () => {
		const mockResults = [
			{ id: "point-1", score: 0.95, payload: { text: "result 1" }, version: 1 },
			{ id: "point-2", score: 0.85, payload: { text: "result 2" }, version: 1 },
		];
		mockQdrantService.search.mockResolvedValue(mockResults);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.search({
			collectionName: "test-collection",
			options: {
				vectorName: "content",
				vector: [0.1, 0.2, 0.3],
				limit: 10,
			},
		});

		expect(result).toEqual(mockResults);
		expect(mockQdrantService.search).toHaveBeenCalledWith(
			"test-collection",
			expect.objectContaining({
				vectorName: "content",
				vector: [0.1, 0.2, 0.3],
				limit: 10,
			}),
		);
	});

	test("searchBatch should perform batch vector search", async () => {
		const mockResults = [
			[
				{ id: "point-1", score: 0.95, payload: {}, version: 1 },
				{ id: "point-2", score: 0.85, payload: {}, version: 1 },
			],
			[
				{ id: "point-3", score: 0.9, payload: {}, version: 1 },
				{ id: "point-4", score: 0.8, payload: {}, version: 1 },
			],
		];
		mockQdrantService.searchBatch.mockResolvedValue(mockResults);

		const caller = qdrantRouter.createCaller(createTestContext());
		const result = await caller.searchBatch({
			collectionName: "test-collection",
			searches: [
				{
					vectorName: "title",
					vector: [0.1, 0.2, 0.3],
					limit: 5,
				},
				{
					vectorName: "content",
					vector: [0.4, 0.5, 0.6],
					limit: 5,
				},
			],
		});

		expect(result).toEqual(mockResults);
		expect(mockQdrantService.searchBatch).toHaveBeenCalledWith(
			"test-collection",
			expect.arrayContaining([
				expect.objectContaining({
					vectorName: "title",
					vector: [0.1, 0.2, 0.3],
					limit: 5,
				}),
				expect.objectContaining({
					vectorName: "content",
					vector: [0.4, 0.5, 0.6],
					limit: 5,
				}),
			]),
		);
	});
});
