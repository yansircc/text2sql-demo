import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { cacheManager } from "@/server/lib/cache-manager";
import { z } from "zod";

export const cacheRouter = createTRPCRouter({
	// Clear all caches
	clearAll: publicProcedure.mutation(async () => {
		console.log("[Cache] Clearing all caches");
		await cacheManager.clearAll();
		return {
			success: true,
			message: "All caches cleared successfully",
		};
	}),

	// Clear specific cache type
	clearType: publicProcedure
		.input(
			z.object({
				type: z.enum(["query", "embedding", "schema", "sql"]),
			}),
		)
		.mutation(async ({ input }) => {
			console.log(`[Cache] Clearing ${input.type} cache`);
			await cacheManager.clearByType(input.type);
			return {
				success: true,
				message: `${input.type} cache cleared successfully`,
			};
		}),

	// Get cache statistics
	stats: publicProcedure.query(async () => {
		const stats = await cacheManager.getStats();
		console.log("[Cache] Retrieving cache statistics", stats);
		return stats;
	}),
});
