import { LRUCache } from "lru-cache";
import crypto from "crypto";

// In-memory cache for development, replace with Redis/CloudFlare KV in production
export class QueryCache {
	private embeddingCache: LRUCache<string, number[]>;
	private queryResultCache: LRUCache<string, any>;
	private schemaCache: LRUCache<string, any>;

	constructor() {
		// Embedding cache - 1000 items, 1 hour TTL
		this.embeddingCache = new LRUCache({
			max: 1000,
			ttl: 1000 * 60 * 60, // 1 hour
		});

		// Query result cache - 500 items, 15 minutes TTL
		this.queryResultCache = new LRUCache({
			max: 500,
			ttl: 1000 * 60 * 15, // 15 minutes
		});

		// Schema cache - 50 items, 1 day TTL
		this.schemaCache = new LRUCache({
			max: 50,
			ttl: 1000 * 60 * 60 * 24, // 1 day
		});
	}

	// Generate cache key from query
	generateKey(query: string, context?: Record<string, any>): string {
		const data = { query, ...context };
		return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
	}

	// Embedding cache methods
	async getEmbedding(text: string): Promise<number[] | undefined> {
		return this.embeddingCache.get(text);
	}

	async setEmbedding(text: string, embedding: number[]): Promise<void> {
		this.embeddingCache.set(text, embedding);
	}

	// Query result cache methods
	async getQueryResult(
		query: string,
		strategy: string,
	): Promise<any | undefined> {
		const key = this.generateKey(query, { strategy });
		return this.queryResultCache.get(key);
	}

	async setQueryResult(
		query: string,
		strategy: string,
		result: any,
	): Promise<void> {
		const key = this.generateKey(query, { strategy });
		this.queryResultCache.set(key, result);
	}

	// Schema cache methods
	async getSchema(tableNames: string[]): Promise<any | undefined> {
		const key = tableNames.sort().join(",");
		return this.schemaCache.get(key);
	}

	async setSchema(tableNames: string[], schema: any): Promise<void> {
		const key = tableNames.sort().join(",");
		this.schemaCache.set(key, schema);
	}

	// Cache stats
	getStats() {
		return {
			embedding: {
				size: this.embeddingCache.size,
				hitRate: this.embeddingCache.calculatedSize || 0,
			},
			queryResult: {
				size: this.queryResultCache.size,
				hitRate: this.queryResultCache.calculatedSize || 0,
			},
			schema: {
				size: this.schemaCache.size,
				hitRate: this.schemaCache.calculatedSize || 0,
			},
		};
	}
}

// Singleton instance
export const queryCache = new QueryCache();