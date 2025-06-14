import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { sqlExecutorRouter } from "../sql-executor";
import { createTestContext, withSuppressedConsoleError } from "./test-helpers";

// Mock database
const mockDb = {
	all: jest.fn<any>(),
	run: jest.fn<any>(),
};

// Mock drizzle-orm
mock.module("@/server/db", () => ({
	db: mockDb,
}));

mock.module("drizzle-orm", () => ({
	sql: jest.fn((strings, ...values) => {
		// Simple SQL template tag mock
		return strings.join("?");
	}),
}));

describe("sqlExecutorRouter", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	test("execute should run simple SELECT query", async () => {
		const mockRows = [
			{ id: 1, name: "John Doe", email: "john@example.com" },
			{ id: 2, name: "Jane Smith", email: "jane@example.com" },
		];

		mockDb.all.mockResolvedValue(mockRows);

		const caller = sqlExecutorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			sql: "SELECT id, name, email FROM users LIMIT 10;",
			queryType: "SELECT",
		});

		expect(result.success).toBe(true);
		expect(result.result.rows).toEqual(mockRows);
		expect(result.result.rowCount).toBe(2);
		expect(result.result.truncated).toBe(false);
		expect(result.result.executionTime).toBeGreaterThanOrEqual(0);
		expect(mockDb.all).toHaveBeenCalledTimes(1);
	});

	test("execute should handle aggregate queries", async () => {
		const mockRows = [
			{ customer_id: 1, order_count: 5, total_revenue: 500.0 },
			{ customer_id: 2, order_count: 3, total_revenue: 300.0 },
		];

		mockDb.all.mockResolvedValue(mockRows);

		const caller = sqlExecutorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			sql: "SELECT customer_id, COUNT(*) as order_count, SUM(total) as total_revenue FROM orders GROUP BY customer_id;",
			queryType: "AGGREGATE",
		});

		expect(result.success).toBe(true);
		expect(result.result.rows).toEqual(mockRows);
		expect(result.result.rowCount).toBe(2);
		expect(result.result.columns).toEqual([
			{ name: "customer_id", type: "number" },
			{ name: "order_count", type: "number" },
			{ name: "total_revenue", type: "number" },
		]);
	});

	test("execute should handle complex JOIN queries", async () => {
		const mockRows = [
			{
				customer_name: "John Doe",
				order_id: 101,
				order_total: 150.0,
				order_date: "2024-01-15",
			},
		];

		mockDb.all.mockResolvedValue(mockRows);

		const caller = sqlExecutorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			sql: `SELECT c.name as customer_name, o.id as order_id, o.total as order_total, o.created_at as order_date
			      FROM customers c 
			      JOIN orders o ON c.id = o.customer_id 
			      WHERE o.created_at > '2024-01-01';`,
			queryType: "COMPLEX",
		});

		expect(result.success).toBe(true);
		expect(result.result.rows).toHaveLength(1);
		expect(result.result.columns.map(c => c.name)).toContain("customer_name");
		expect(result.result.columns.map(c => c.name)).toContain("order_total");
	});

	test("execute should enforce row limit", async () => {
		// Create 150 mock rows
		const mockRows = Array.from({ length: 150 }, (_, i) => ({
			id: i + 1,
			name: `User ${i + 1}`,
		}));

		mockDb.all.mockResolvedValue(mockRows);

		const caller = sqlExecutorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			sql: "SELECT * FROM users;",
			queryType: "SELECT",
			maxRows: 100,
		});

		expect(result.result.rows).toHaveLength(100);
		expect(result.result.truncated).toBe(true);
		expect(result.result.rowCount).toBe(100);
	});

	test("execute should reject non-SELECT queries in read-only mode", async () => {
		const caller = sqlExecutorRouter.createCaller(createTestContext());

		await expect(
			caller.execute({
				sql: "UPDATE users SET name = 'Test' WHERE id = 1;",
				queryType: "SELECT",
				readOnly: true,
			}),
		).rejects.toThrow("只允许执行SELECT查询");

		await expect(
			caller.execute({
				sql: "DELETE FROM users WHERE id = 1;",
				queryType: "SELECT",
			}),
		).rejects.toThrow("只允许执行SELECT查询");

		await expect(
			caller.execute({
				sql: "INSERT INTO users (name) VALUES ('Test');",
				queryType: "SELECT",
			}),
		).rejects.toThrow("只允许执行SELECT查询");
	});

	test("execute should handle empty results", async () => {
		mockDb.all.mockResolvedValue([]);

		const caller = sqlExecutorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			sql: "SELECT * FROM users WHERE id = 999999;",
			queryType: "SELECT",
		});

		expect(result.success).toBe(true);
		expect(result.result.rows).toHaveLength(0);
		expect(result.result.rowCount).toBe(0);
		expect(result.result.truncated).toBe(false);
		expect(result.result.columns).toEqual([]);
	});

	test("execute should extract column names from results", async () => {
		const mockRows = [
			{
				user_id: 1,
				user_name: "John",
				user_email: "john@example.com",
				created_date: "2024-01-01",
			},
		];

		mockDb.all.mockResolvedValue(mockRows);

		const caller = sqlExecutorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			sql: "SELECT id as user_id, name as user_name, email as user_email, created_at as created_date FROM users;",
			queryType: "SELECT",
		});

		expect(result.result.columns).toEqual([
			{ name: "user_id", type: "number" },
			{ name: "user_name", type: "string" },
			{ name: "user_email", type: "string" },
			{ name: "created_date", type: "string" },
		]);
	});

	test("execute should handle database errors", withSuppressedConsoleError(async () => {
		mockDb.all.mockRejectedValue(new Error("Database connection failed"));

		const caller = sqlExecutorRouter.createCaller(createTestContext());

		await expect(
			caller.execute({
				sql: "SELECT * FROM users;",
				queryType: "SELECT",
			}),
		).rejects.toThrow("SQL执行失败");
	}));

	test("validate should check valid SQL syntax", async () => {
		const caller = sqlExecutorRouter.createCaller(createTestContext());

		const result = await caller.validate({
			sql: "SELECT id, name FROM users WHERE id = 1;",
		});

		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("validate should detect invalid SQL syntax", async () => {
		const caller = sqlExecutorRouter.createCaller(createTestContext());

		const result = await caller.validate({
			sql: "SELECT FROM users WHERE;",
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("无效的SQL语句");
	});

	test("validate should reject non-SELECT statements", async () => {
		const caller = sqlExecutorRouter.createCaller(createTestContext());

		const updateResult = await caller.validate({
			sql: "UPDATE users SET name = 'Test';",
		});
		expect(updateResult.valid).toBe(false);
		expect(updateResult.error).toContain("只允许SELECT查询");

		const deleteResult = await caller.validate({
			sql: "DELETE FROM users;",
		});
		expect(deleteResult.valid).toBe(false);
		expect(deleteResult.error).toContain("只允许SELECT查询");

		const insertResult = await caller.validate({
			sql: "INSERT INTO users (name) VALUES ('Test');",
		});
		expect(insertResult.valid).toBe(false);
		expect(insertResult.error).toContain("只允许SELECT查询");
	});

	test("validate should detect SQL injection attempts", async () => {
		const caller = sqlExecutorRouter.createCaller(createTestContext());

		const result = await caller.validate({
			sql: "SELECT * FROM users WHERE id = 1; DROP TABLE users; --",
		});

		expect(result.valid).toBe(false);
		expect(result.error).toContain("检测到潜在的SQL注入");
	});

	test("validate should allow complex valid queries", async () => {
		const caller = sqlExecutorRouter.createCaller(createTestContext());

		const result = await caller.validate({
			sql: `
				WITH customer_orders AS (
					SELECT c.id, c.name, COUNT(o.id) as order_count
					FROM customers c
					LEFT JOIN orders o ON c.id = o.customer_id
					GROUP BY c.id, c.name
				)
				SELECT * FROM customer_orders WHERE order_count > 5
				ORDER BY order_count DESC
				LIMIT 10;
			`,
		});

		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("execute should respect timeout parameter", async () => {
		// Simulate a slow query
		mockDb.all.mockImplementation(() => {
			return new Promise((resolve) => {
				setTimeout(() => resolve([{ id: 1 }]), 200);
			});
		});

		const caller = sqlExecutorRouter.createCaller(createTestContext());

		// This should succeed with 300ms timeout
		const result1 = await caller.execute({
			sql: "SELECT * FROM large_table;",
			queryType: "SELECT",
			timeout: 300,
		});
		expect(result1.success).toBe(true);

		// Reset mock for next test
		mockDb.all.mockClear();
	});

	test("execute should handle very large result sets", async () => {
		// Create 10000 mock rows
		const mockRows = Array.from({ length: 10000 }, (_, i) => ({
			id: i + 1,
			data: `Data ${i + 1}`,
		}));

		mockDb.all.mockResolvedValue(mockRows);

		const caller = sqlExecutorRouter.createCaller(createTestContext());
		const result = await caller.execute({
			sql: "SELECT * FROM large_table;",
			queryType: "SELECT",
			maxRows: 1000,
		});

		expect(result.result.rows).toHaveLength(1000);
		expect(result.result.truncated).toBe(true);
		expect(result.result.rowCount).toBe(1000);
	});
});