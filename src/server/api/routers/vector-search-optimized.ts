import { queryCache } from "@/lib/cache";

// Optimized vector search with batching and caching
export const optimizedVectorSearch = async (queries: VectorQuery[]) => {
	// Group queries by table for batch processing
	const queriesByTable = queries.reduce((acc, query) => {
		if (!acc[query.table]) acc[query.table] = [];
		acc[query.table].push(query);
		return acc;
	}, {} as Record<string, VectorQuery[]>);

	// Process all tables in parallel
	const tableResults = await Promise.all(
		Object.entries(queriesByTable).map(async ([table, tableQueries]) => {
			// Check cache first
			const cacheKey = `vector_${table}_${tableQueries.map(q => q.searchText).join("_")}`;
			const cached = await queryCache.getQueryResult(cacheKey, "vector");
			if (cached) {
				console.log(`[VectorSearch] Cache hit for table ${table}`);
				return cached;
			}

			// Batch generate embeddings
			const embeddings = await batchGenerateEmbeddings(
				tableQueries.map(q => q.searchText)
			);

			// Batch search in Qdrant
			const results = await qdrantClient.search({
				collectionName: process.env.QDRANT_DEFAULT_COLLECTION!,
				vector: embeddings[0], // Use first embedding as primary
				filter: {
					must: [
						{
							key: "table",
							match: { value: table },
						},
					],
				},
				limit: Math.max(...tableQueries.map(q => q.limit || 10)),
				withPayload: true,
			});

			// Cache results
			await queryCache.setQueryResult(cacheKey, "vector", results);
			
			return { table, results };
		})
	);

	return combineTableResults(tableResults);
};

// Batch embedding generation with caching
async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
	// Check cache for existing embeddings
	const embeddings = await Promise.all(
		texts.map(async (text) => {
			const cached = await queryCache.getEmbedding(text);
			if (cached) return cached;
			
			// Generate new embedding
			const embedding = await generateEmbedding(text);
			await queryCache.setEmbedding(text, embedding);
			return embedding;
		})
	);
	
	return embeddings;
}