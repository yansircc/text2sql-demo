import { desc } from "drizzle-orm";
import { env } from "../env";
import { embedText } from "../lib/embed-text";
import type { PointData } from "../lib/qdrant/schema";
import { qdrantService } from "../lib/qdrant/service";
import { db } from "../server/db";
import { companies } from "../server/db/schema";

/**
 * 优化版公司数据向量化 - 使用Named Vectors
 * 每家公司一个point，包含多个命名向量
 */

interface CompanyVectorData extends PointData {
	payload: {
		companyId: number;
		hasRequiredProducts: boolean;
		hasRemark: boolean;
		// 完整的公司数据作为metadata
		name?: string;
		country?: string;
		requiredProducts19978277361?: string;
		remark?: string;
		[key: string]: unknown;
	};
}

async function vectorizeCompaniesOptimized() {
	console.log("🚀 开始优化版公司数据向量化 (Named Vectors)");
	console.log("=".repeat(60));

	const collectionName = env.QDRANT_DEFAULT_COLLECTION + "_optimized";

	try {
		// 1. 检查并创建集合
		const exists = await qdrantService.collectionExists(collectionName);
		if (exists) {
			console.log("🗑️  删除现有集合:", collectionName);
			await qdrantService.deleteCollection(collectionName);
		}

		console.log("📁 创建新集合:", collectionName);
		await qdrantService.createCollection(collectionName, {
			vectors: {
				// 两个命名向量配置
				requiredProducts: {
					size: Number(env.EMBEDDING_DIMENSION),
					distance: "Cosine",
				},
				remark: {
					size: Number(env.EMBEDDING_DIMENSION),
					distance: "Cosine",
				},
			},
		});

		// 2. 获取公司数据
		console.log("\n📊 获取公司数据...");
		const companiesData = await db
			.select()
			.from(companies)
			.orderBy(desc(companies.companyId))
			.limit(50);

		console.log(`✅ 获取到 ${companiesData.length} 家公司数据`);

		// 3. 处理向量化
		const vectorData: CompanyVectorData[] = [];
		let successCount = 0;
		let skipCount = 0;

		for (const [index, company] of companiesData.entries()) {
			console.log(
				`\n🔄 处理公司 ${index + 1}/${companiesData.length}: ID ${company.companyId}`,
			);

			const vectors: Record<string, number[]> = {};
			let hasAnyVector = false;

			// 向量化 requiredProducts 字段
			if (company.requiredProducts19978277361?.trim()) {
				console.log("  📝 向量化 requiredProducts 字段...");
				const embedding = await embedText(company.requiredProducts19978277361);
				if (embedding) {
					vectors.requiredProducts = embedding;
					hasAnyVector = true;
					console.log(
						`  ✅ requiredProducts 向量化完成 (${embedding.length}维)`,
					);
				} else {
					console.log("  ⚠️  requiredProducts 向量化失败");
				}
			}

			// 向量化 remark 字段
			if (company.remark?.trim()) {
				console.log("  📝 向量化 remark 字段...");
				const embedding = await embedText(company.remark);
				if (embedding) {
					vectors.remark = embedding;
					hasAnyVector = true;
					console.log(`  ✅ remark 向量化完成 (${embedding.length}维)`);
				} else {
					console.log("  ⚠️  remark 向量化失败");
				}
			}

			// 如果有任何向量，添加到数据中
			if (hasAnyVector) {
				vectorData.push({
					id: company.companyId,
					vectors,
					payload: {
						companyId: company.companyId,
						hasRequiredProducts: !!vectors.requiredProducts,
						hasRemark: !!vectors.remark,
						// 包含完整的公司数据
						name: company.name ?? undefined,
						country: company.country ?? undefined,
						requiredProducts19978277361:
							company.requiredProducts19978277361 ?? undefined,
						remark: company.remark ?? undefined,
						// 其他字段
						serialId: company.serialId,
						shortName: company.shortName,
						countryName: company.countryName,
					},
				});
				successCount++;
				console.log(`  ✅ 公司 ${company.companyId} 处理完成`);
			} else {
				skipCount++;
				console.log(`  ⏭️  公司 ${company.companyId} 无有效文本，跳过`);
			}
		}

		// 4. 批量写入 Qdrant
		console.log("\n📤 批量写入向量数据...");
		console.log(`  成功处理: ${successCount} 家公司`);
		console.log(`  跳过: ${skipCount} 家公司`);
		console.log(`  总计向量点: ${vectorData.length} 个`);

		if (vectorData.length > 0) {
			// 分批处理，每批10个
			const batchSize = 10;
			for (let i = 0; i < vectorData.length; i += batchSize) {
				const batch = vectorData.slice(i, i + batchSize);
				console.log(
					`\n📦 写入批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectorData.length / batchSize)}`,
				);

				await qdrantService.upsertPoints(collectionName, batch, true);
				console.log(`  ✅ 批次写入完成 (${batch.length} 个点)`);
			}

			console.log("\n🎉 所有数据写入完成！");
		} else {
			console.log("\n⚠️  没有向量数据需要写入");
		}

		// 5. 验证数据
		console.log("\n🔍 验证集合状态...");
		const collection = await qdrantService.getCollection(collectionName);
		console.log("  集合信息:", JSON.stringify(collection, null, 2));

		// 6. 测试搜索 - 使用 Named Vector 搜索
		console.log("\n🔎 测试搜索功能...");
		await validateVectorizeCompanies(collectionName, "文档管理软件");
	} catch (error) {
		console.error("❌ 向量化过程出错:", error);
		throw error;
	}
}

const validateVectorizeCompanies = async (
	collectionName: string,
	query: string,
) => {
	try {
		// 生成搜索向量
		const searchQuery = query;
		const searchVector = await embedText(searchQuery);

		if (searchVector) {
			// 测试 requiredProducts 向量搜索
			console.log("\n🔎 测试 requiredProducts 向量搜索...");
			const requiredProductsResults = await qdrantService.searchNamedVector(
				collectionName,
				{
					vectorName: "requiredProducts",
					vector: searchVector,
					limit: 3,
					withPayload: true,
					withVectors: false,
				},
			);

			console.log("📋 requiredProducts 搜索结果:");
			console.log(`  找到 ${requiredProductsResults.length} 个相关结果`);

			for (const [index, result] of requiredProductsResults.entries()) {
				console.log(`\n  结果 ${index + 1}:`);
				console.log(`    公司ID: ${result.payload?.companyId}`);
				console.log(`    公司名称: ${result.payload?.name}`);
				console.log(`    评分: ${result.score}`);
			}

			// 测试 remark 向量搜索
			console.log("\n🔎 测试 remark 向量搜索...");
			const remarkResults = await qdrantService.searchNamedVector(
				collectionName,
				{
					vectorName: "remark",
					vector: searchVector,
					limit: 3,
					withPayload: true,
					withVectors: false,
				},
			);

			console.log("📋 remark 搜索结果:");
			console.log(`  找到 ${remarkResults.length} 个相关结果`);

			for (const [index, result] of remarkResults.entries()) {
				console.log(`\n  结果 ${index + 1}:`);
				console.log(`    公司ID: ${result.payload?.companyId}`);
				console.log(`    公司名称: ${result.payload?.name}`);
				console.log(`    评分: ${result.score}`);
			}
		} else {
			console.log("❌ 无法生成搜索向量");
		}
	} catch (searchError) {
		console.error("❌ 搜索测试失败:", searchError);
	}
};

// 执行脚本
if (require.main === module) {
	vectorizeCompaniesOptimized()
		.then(() => {
			console.log("\n✨ 优化版向量化完成！");
			process.exit(0);
		})
		.catch((error) => {
			console.error("💥 向量化失败:", error);
			process.exit(1);
		});
}

export { vectorizeCompaniesOptimized, validateVectorizeCompanies };
