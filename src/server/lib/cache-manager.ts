import { createHash } from "node:crypto";
import { env } from "@/env";
import { CACHE_KEYS, getRedis } from "@/server/db/redis";
import type { Redis } from "ioredis";

export interface CacheConfig {
	enabled: boolean;
	ttl: {
		embeddings: number;
		queryAnalysis: number;
		schemaSelection: number;
		sqlGeneration: number;
	};
	maxSize: {
		embeddings: number;
		queryAnalysis: number;
		schemaSelection: number;
		sqlGeneration: number;
	};
}

export const cacheConfig: CacheConfig = {
	enabled: env.ENABLE_QUERY_CACHE,
	ttl: {
		embeddings: 3600, // 1 hour (in seconds for Redis)
		queryAnalysis: 900, // 15 minutes
		schemaSelection: 1800, // 30 minutes
		sqlGeneration: 600, // 10 minutes
	},
	maxSize: {
		embeddings: 10000,
		queryAnalysis: 1000,
		schemaSelection: 500,
		sqlGeneration: 500,
	},
};

export class CacheManager {
	private static instance: CacheManager;
	private redis: Redis | null = null;
	private fallbackCache: Map<string, { value: any; expiry: number }> =
		new Map();

	private constructor() {
		if (cacheConfig.enabled) {
			try {
				this.redis = getRedis();
			} catch (error) {
				console.error("Failed to initialize Redis:", error);
				// Will use fallback cache
			}
		}
	}

	public static getInstance(): CacheManager {
		if (!CacheManager.instance) {
			CacheManager.instance = new CacheManager();
		}
		return CacheManager.instance;
	}

	// Generate cache key using input hash
	public generateCacheKey(prefix: string, data: any): string {
		const hash = createHash("md5").update(JSON.stringify(data)).digest("hex");
		return `${prefix}:${hash}`;
	}

	// Generic get method with fallback
	private async getFromCache(key: string): Promise<any | undefined> {
		if (!cacheConfig.enabled) return undefined;

		try {
			if (this.redis) {
				const value = await this.redis.get(key);
				return value ? JSON.parse(value) : undefined;
			}
		} catch (error) {
			console.error(`Redis GET error for key ${key}:`, error);
		}

		// Fallback to in-memory cache
		const cached = this.fallbackCache.get(key);
		if (cached && cached.expiry > Date.now()) {
			return cached.value;
		}
		this.fallbackCache.delete(key);
		return undefined;
	}

	// Generic set method with fallback
	private async setInCache(
		key: string,
		value: any,
		ttl: number,
	): Promise<void> {
		if (!cacheConfig.enabled) return;

		try {
			if (this.redis) {
				await this.redis.setex(key, ttl, JSON.stringify(value));
				return;
			}
		} catch (error) {
			console.error(`Redis SET error for key ${key}:`, error);
		}

		// Fallback to in-memory cache
		this.fallbackCache.set(key, {
			value,
			expiry: Date.now() + ttl * 1000,
		});

		// Clean up expired entries periodically
		if (this.fallbackCache.size > 1000) {
			const now = Date.now();
			for (const [k, v] of this.fallbackCache.entries()) {
				if (v.expiry < now) {
					this.fallbackCache.delete(k);
				}
			}
		}
	}

	// Query Analysis Cache
	public async getQueryAnalysis(key: string): Promise<any | undefined> {
		const redisKey = CACHE_KEYS.queryAnalysis(key);
		return this.getFromCache(redisKey);
	}

	public async setQueryAnalysis(key: string, value: any): Promise<void> {
		const redisKey = CACHE_KEYS.queryAnalysis(key);
		await this.setInCache(redisKey, value, cacheConfig.ttl.queryAnalysis);
	}

	// Embedding Cache
	public async getEmbedding(text: string): Promise<number[] | undefined> {
		const redisKey = CACHE_KEYS.embedding(text);
		return this.getFromCache(redisKey);
	}

	public async setEmbedding(text: string, embedding: number[]): Promise<void> {
		const redisKey = CACHE_KEYS.embedding(text);
		await this.setInCache(redisKey, embedding, cacheConfig.ttl.embeddings);
	}

	// Schema Cache
	public async getSchemaSelection(key: string): Promise<any | undefined> {
		const redisKey = CACHE_KEYS.schemaSelection(key);
		return this.getFromCache(redisKey);
	}

	public async setSchemaSelection(key: string, value: any): Promise<void> {
		const redisKey = CACHE_KEYS.schemaSelection(key);
		await this.setInCache(redisKey, value, cacheConfig.ttl.schemaSelection);
	}

	// SQL Cache
	public async getSqlGeneration(key: string): Promise<any | undefined> {
		const redisKey = CACHE_KEYS.sqlGeneration(key);
		return this.getFromCache(redisKey);
	}

	public async setSqlGeneration(key: string, value: any): Promise<void> {
		const redisKey = CACHE_KEYS.sqlGeneration(key);
		await this.setInCache(redisKey, value, cacheConfig.ttl.sqlGeneration);
	}

	// Cache Management
	public async clearAll(): Promise<void> {
		if (!cacheConfig.enabled) return;

		try {
			if (this.redis) {
				// Clear all Text2SQL related keys
				const patterns = [
					"text2sql:query:analysis:*",
					"text2sql:schema:selection:*",
					"text2sql:sql:generation:*",
					"text2sql:embedding:*",
				];

				for (const pattern of patterns) {
					const keys = await this.redis.keys(pattern);
					if (keys.length > 0) {
						await this.redis.del(...keys);
					}
				}
			}
		} catch (error) {
			console.error("Redis CLEAR ALL error:", error);
		}

		// Clear fallback cache
		this.fallbackCache.clear();
	}

	public async clearByType(
		type: "query" | "embedding" | "schema" | "sql",
	): Promise<void> {
		if (!cacheConfig.enabled) return;

		const patternMap = {
			query: "text2sql:query:analysis:*",
			embedding: "text2sql:embedding:*",
			schema: "text2sql:schema:selection:*",
			sql: "text2sql:sql:generation:*",
		};

		try {
			if (this.redis) {
				const pattern = patternMap[type];
				const keys = await this.redis.keys(pattern);
				if (keys.length > 0) {
					await this.redis.del(...keys);
				}
			}
		} catch (error) {
			console.error(`Redis CLEAR ${type} error:`, error);
		}

		// Clear from fallback cache
		const prefix = patternMap[type].replace("*", "");
		for (const key of this.fallbackCache.keys()) {
			if (key.startsWith(prefix)) {
				this.fallbackCache.delete(key);
			}
		}
	}

	public async getStats() {
		const stats = {
			enabled: cacheConfig.enabled,
			redisConnected: !!this.redis,
			stats: {
				query: { size: 0, maxSize: cacheConfig.maxSize.queryAnalysis },
				embedding: { size: 0, maxSize: cacheConfig.maxSize.embeddings },
				schema: { size: 0, maxSize: cacheConfig.maxSize.schemaSelection },
				sql: { size: 0, maxSize: cacheConfig.maxSize.sqlGeneration },
			},
			fallbackCacheSize: this.fallbackCache.size,
		};

		if (!cacheConfig.enabled) return stats;

		try {
			if (this.redis) {
				const patterns = {
					query: "text2sql:query:analysis:*",
					embedding: "text2sql:embedding:*",
					schema: "text2sql:schema:selection:*",
					sql: "text2sql:sql:generation:*",
				};

				for (const [type, pattern] of Object.entries(patterns)) {
					const keys = await this.redis.keys(pattern);
					stats.stats[type as keyof typeof stats.stats].size = keys.length;
				}
			}
		} catch (error) {
			console.error("Redis STATS error:", error);
		}

		return stats;
	}
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
