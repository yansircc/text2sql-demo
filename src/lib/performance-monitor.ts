export class PerformanceMonitor {
	private metrics: Map<string, number[]> = new Map();

	async track<T>(
		operation: string,
		fn: () => Promise<T>,
	): Promise<{ result: T; duration: number }> {
		const start = performance.now();
		
		try {
			const result = await fn();
			const duration = performance.now() - start;
			
			// Track metrics
			if (!this.metrics.has(operation)) {
				this.metrics.set(operation, []);
			}
			this.metrics.get(operation)!.push(duration);
			
			// Log slow operations
			if (duration > 1000) {
				console.warn(`[Performance] Slow operation: ${operation} took ${duration}ms`);
			}
			
			return { result, duration };
		} catch (error) {
			const duration = performance.now() - start;
			console.error(`[Performance] Failed operation: ${operation} after ${duration}ms`);
			throw error;
		}
	}

	getStats(operation: string) {
		const durations = this.metrics.get(operation) || [];
		if (durations.length === 0) return null;
		
		const sorted = [...durations].sort((a, b) => a - b);
		return {
			count: durations.length,
			min: sorted[0],
			max: sorted[sorted.length - 1],
			avg: durations.reduce((a, b) => a + b, 0) / durations.length,
			p50: sorted[Math.floor(sorted.length * 0.5)],
			p95: sorted[Math.floor(sorted.length * 0.95)],
			p99: sorted[Math.floor(sorted.length * 0.99)],
		};
	}

	getAllStats() {
		const stats: Record<string, any> = {};
		for (const [operation] of this.metrics) {
			stats[operation] = this.getStats(operation);
		}
		return stats;
	}
}

export const perfMonitor = new PerformanceMonitor();