import { db } from "@/server/db";

export const createTestContext = () => ({
	db,
	headers: new Headers(),
});

/**
 * Suppresses console.error messages during test execution.
 * Useful for tests that expect errors to be thrown.
 * 
 * @example
 * ```typescript
 * test('should throw an error', async () => {
 *   const { restore, mockError } = suppressConsoleError();
 *   
 *   try {
 *     await expect(() => someFunction()).toThrow('Expected error');
 *     // You can also check if console.error was called
 *     expect(mockError).toHaveBeenCalled();
 *   } finally {
 *     restore();
 *   }
 * });
 * ```
 */
export const suppressConsoleError = () => {
	const originalError = console.error;
	const calls: any[] = [];
	
	const mockError = (...args: any[]) => {
		calls.push(args);
	};
	
	// Add mock properties for compatibility
	mockError.calls = calls;
	mockError.toHaveBeenCalled = () => calls.length > 0;
	mockError.toHaveBeenCalledWith = (...args: any[]) => 
		calls.some(call => JSON.stringify(call) === JSON.stringify(args));
	
	console.error = mockError;
	
	return {
		mockError,
		restore: () => {
			console.error = originalError;
		},
	};
};

/**
 * Higher-order function that wraps a test function to suppress console.error.
 * Automatically restores console.error after the test completes.
 * 
 * @example
 * ```typescript
 * test('should throw an error', withSuppressedConsoleError(async () => {
 *   await expect(() => someFunction()).toThrow('Expected error');
 * }));
 * ```
 */
export const withSuppressedConsoleError = <T>(
	testFn: () => T | Promise<T>
): (() => Promise<T>) => {
	return async () => {
		const { restore } = suppressConsoleError();
		try {
			return await testFn();
		} finally {
			restore();
		}
	};
};
