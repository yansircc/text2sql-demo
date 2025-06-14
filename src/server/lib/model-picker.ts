import { env } from "@/env";
import { createOpenAI } from "@ai-sdk/openai";

export type ModelName =
	| "gpt-4o-mini"
	| "gpt-4.1"
	| "claude-3-sonnet-20240229"
	| "claude-3-opus-20240229";

export interface ModelConfig {
	name: ModelName;
	cost: number; // relative cost (1-10)
	speed: number; // relative speed (1-10, higher is faster)
	quality: number; // relative quality (1-10)
	contextWindow: number;
}

// Model configurations with performance characteristics
export const modelConfigs: Record<ModelName, ModelConfig> = {
	"gpt-4o-mini": {
		name: "gpt-4o-mini",
		cost: 1,
		speed: 10,
		quality: 6,
		contextWindow: 128000,
	},
	"gpt-4.1": {
		name: "gpt-4.1",
		cost: 3,
		speed: 7,
		quality: 8,
		contextWindow: 128000,
	},
	"claude-3-sonnet-20240229": {
		name: "claude-3-sonnet-20240229",
		cost: 5,
		speed: 5,
		quality: 9,
		contextWindow: 200000,
	},
	"claude-3-opus-20240229": {
		name: "claude-3-opus-20240229",
		cost: 10,
		speed: 3,
		quality: 10,
		contextWindow: 200000,
	},
};

// Model hierarchy for progressive rollback
const modelHierarchy: ModelName[] = [
	"gpt-4o-mini",
	"gpt-4.1",
	"claude-3-sonnet-20240229",
	"claude-3-opus-20240229",
];

export interface ModelPickerOptions {
	complexity?: "easy" | "medium" | "hard" | "very_hard";
	preferSpeed?: boolean;
	minQuality?: number;
	maxCost?: number;
	contextSize?: number;
}

export class SmartModelPicker {
	private static instance: SmartModelPicker;
	private executionHistory: Map<
		string,
		{
			model: ModelName;
			success: boolean;
			executionTime: number;
		}[]
	> = new Map();

	private constructor() {}

	public static getInstance(): SmartModelPicker {
		if (!SmartModelPicker.instance) {
			SmartModelPicker.instance = new SmartModelPicker();
		}
		return SmartModelPicker.instance;
	}

	/**
	 * Pick the optimal model based on task requirements
	 */
	public pickModel(
		taskType: string,
		options: ModelPickerOptions = {},
	): ModelName {
		const {
			complexity = "medium",
			preferSpeed = false,
			minQuality = 6,
			maxCost = 10,
			contextSize = 0,
		} = options;

		// Check execution history for this task type
		const history = this.executionHistory.get(taskType);
		if (history && history.length > 0) {
			// Find the cheapest successful model from history
			const successfulModels = history
				.filter((h) => h.success)
				.map((h) => h.model)
				.filter((model, index, self) => self.indexOf(model) === index);

			if (successfulModels.length > 0) {
				const cheapestSuccessful = successfulModels.sort(
					(a, b) => modelConfigs[a].cost - modelConfigs[b].cost,
				)[0];
				if (cheapestSuccessful) {
					console.log(
						`[ModelPicker] Using historically successful model: ${cheapestSuccessful}`,
					);
					return cheapestSuccessful;
				}
			}
		}

		// Default selection based on complexity
		let candidates: ModelName[] = [...modelHierarchy];

		// Filter by context size requirement
		if (contextSize > 0) {
			candidates = candidates.filter(
				(model) => modelConfigs[model].contextWindow >= contextSize,
			);
		}

		// Filter by quality requirement
		candidates = candidates.filter(
			(model) => modelConfigs[model].quality >= minQuality,
		);

		// Filter by cost constraint
		candidates = candidates.filter(
			(model) => modelConfigs[model].cost <= maxCost,
		);

		if (candidates.length === 0) {
			console.warn(
				"[ModelPicker] No models match criteria, using GPT-4.1 as fallback",
			);
			return "gpt-4.1";
		}

		// Select based on complexity and preferences
		if (complexity === "easy" || preferSpeed) {
			// Pick fastest model that meets criteria
			const fastest = candidates.sort(
				(a, b) => modelConfigs[b].speed - modelConfigs[a].speed,
			)[0];
			return fastest || "gpt-4.1";
		} else if (complexity === "very_hard") {
			// Pick highest quality model
			const highest = candidates.sort(
				(a, b) => modelConfigs[b].quality - modelConfigs[a].quality,
			)[0];
			return highest || "claude-3-opus-20240229";
		} else {
			// Balance between cost and quality
			const scores = candidates.map((model) => {
				const config = modelConfigs[model];
				return {
					model,
					score: (config.quality * 2 + config.speed) / config.cost,
				};
			});

			const best = scores.sort((a, b) => b.score - a.score)[0];
			return best?.model || "gpt-4.1";
		}
	}

	/**
	 * Get the next model in the hierarchy for rollback
	 */
	public getNextModel(currentModel: ModelName): ModelName | null {
		const currentIndex = modelHierarchy.indexOf(currentModel);
		if (currentIndex === -1 || currentIndex === modelHierarchy.length - 1) {
			return null; // No better model available
		}
		const nextModel = modelHierarchy[currentIndex + 1];
		return nextModel || null;
	}

	/**
	 * Record execution result for learning
	 */
	public recordExecution(
		taskType: string,
		model: ModelName,
		success: boolean,
		executionTime: number,
	): void {
		if (!this.executionHistory.has(taskType)) {
			this.executionHistory.set(taskType, []);
		}

		const history = this.executionHistory.get(taskType)!;
		history.push({ model, success, executionTime });

		// Keep only last 100 executions per task type
		if (history.length > 100) {
			history.shift();
		}
	}

	/**
	 * Create an AI instance for the selected model
	 */
	public createAIInstance(model: ModelName) {
		return createOpenAI({
			apiKey: env.AIHUBMIX_API_KEY,
			baseURL: env.AIHUBMIX_BASE_URL,
		})(model);
	}

	/**
	 * Execute with progressive rollback strategy
	 */
	public async executeWithRollback<T>(
		taskType: string,
		taskFunction: (model: any) => Promise<T>,
		options: ModelPickerOptions = {},
	): Promise<{ result: T; model: ModelName; attempts: number }> {
		let currentModel = this.pickModel(taskType, options);
		let attempts = 0;
		const maxAttempts = 4;

		while (attempts < maxAttempts) {
			attempts++;
			const startTime = Date.now();

			try {
				console.log(
					`[ModelPicker] Attempt ${attempts} with model: ${currentModel}`,
				);
				const aiInstance = this.createAIInstance(currentModel);
				const result = await taskFunction(aiInstance);

				// Record successful execution
				this.recordExecution(
					taskType,
					currentModel,
					true,
					Date.now() - startTime,
				);

				return { result, model: currentModel, attempts };
			} catch (error) {
				console.error(`[ModelPicker] Failed with ${currentModel}:`, error);

				// Record failed execution
				this.recordExecution(
					taskType,
					currentModel,
					false,
					Date.now() - startTime,
				);

				// Try next model in hierarchy
				const nextModel = this.getNextModel(currentModel);
				if (!nextModel) {
					throw new Error(
						`All models failed. Last error: ${error instanceof Error ? error.message : String(error)}`,
					);
				}

				currentModel = nextModel;
			}
		}

		throw new Error(`Failed after ${maxAttempts} attempts`);
	}

	/**
	 * Get execution statistics for a task type
	 */
	public getStats(taskType: string) {
		const history = this.executionHistory.get(taskType) || [];
		const modelStats = new Map<
			ModelName,
			{
				attempts: number;
				successes: number;
				avgTime: number;
			}
		>();

		history.forEach(({ model, success, executionTime }) => {
			if (!modelStats.has(model)) {
				modelStats.set(model, { attempts: 0, successes: 0, avgTime: 0 });
			}

			const stats = modelStats.get(model)!;
			stats.attempts++;
			if (success) stats.successes++;
			stats.avgTime =
				(stats.avgTime * (stats.attempts - 1) + executionTime) / stats.attempts;
		});

		return Object.fromEntries(modelStats);
	}
}

export const modelPicker = SmartModelPicker.getInstance();
