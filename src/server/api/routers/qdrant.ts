import {
	collectionConfigSchema,
	hybridSearchOptionsSchema,
	namedVectorSearchOptionsSchema,
	payloadIndexSchema,
	pointDataSchema,
} from "@/lib/qdrant/schema";
import { qdrantService } from "@/lib/qdrant/service";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const qdrantRouter = createTRPCRouter({
	// Collection operations
	listCollections: publicProcedure.query(async () => {
		return await qdrantService.listCollections();
	}),

	getCollection: publicProcedure
		.input(z.object({ collectionName: z.string() }))
		.query(async ({ input }) => {
			return await qdrantService.getCollection(input.collectionName);
		}),

	createCollection: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				config: collectionConfigSchema,
			}),
		)
		.mutation(async ({ input }) => {
			return await qdrantService.createCollection(
				input.collectionName,
				input.config,
			);
		}),

	deleteCollection: publicProcedure
		.input(z.object({ collectionName: z.string() }))
		.mutation(async ({ input }) => {
			return await qdrantService.deleteCollection(input.collectionName);
		}),

	// Payload index operations
	createPayloadIndex: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				options: payloadIndexSchema,
			}),
		)
		.mutation(async ({ input }) => {
			return await qdrantService.createPayloadIndex(
				input.collectionName,
				input.options,
			);
		}),

	// Points operations - Named Vectors only
	upsertPoints: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				points: z.array(pointDataSchema),
				wait: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			return await qdrantService.upsertPoints(
				input.collectionName,
				input.points,
				input.wait,
			);
		}),

	deletePoints: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				pointIds: z.array(z.union([z.string(), z.number()])),
				wait: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			return await qdrantService.deletePoints(
				input.collectionName,
				input.pointIds,
				input.wait,
			);
		}),

	deletePointsByDocumentId: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				documentId: z.string(),
				wait: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			// Create a filter that matches points with this document ID
			const filter = {
				filter: {
					must: [
						{
							key: "documentId",
							match: {
								value: input.documentId,
							},
						},
					],
				},
			};

			return await qdrantService.deletePoints(
				input.collectionName,
				filter,
				input.wait,
			);
		}),

	retrievePoints: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				pointIds: z.array(z.union([z.string(), z.number()])),
			}),
		)
		.query(async ({ input }) => {
			return await qdrantService.retrievePoints(
				input.collectionName,
				input.pointIds,
			);
		}),

	// Search operations - Named Vectors only
	searchNamedVector: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				options: namedVectorSearchOptionsSchema,
			}),
		)
		.query(async ({ input }) => {
			return await qdrantService.searchNamedVector(
				input.collectionName,
				input.options,
			);
		}),

	searchBatch: publicProcedure
		.input(
			z.object({
				collectionName: z.string(),
				searches: z.array(namedVectorSearchOptionsSchema),
			}),
		)
		.query(async ({ input }) => {
			return await qdrantService.searchBatch(
				input.collectionName,
				input.searches,
			);
		}),

	// 混合搜索 - 支持多个命名向量
	hybridSearch: publicProcedure
		.input(hybridSearchOptionsSchema)
		.mutation(async ({ input }) => {
			try {
				return await qdrantService.hybridSearch(input);
			} catch (error) {
				console.error("Hybrid search error:", error);
				throw error;
			}
		}),
});
