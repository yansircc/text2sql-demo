import { desc } from "drizzle-orm";
import { env } from "../env";
import { embedText } from "../lib/embed-text";
import { qdrantService } from "../lib/qdrant/service";
import { db } from "../server/db";
import { type Company, companies } from "../server/db/schema";

interface CompanyVectorData {
	id: number; // 改为数值类型
	vector: number[];
	payload: {
		text: string;
		fieldType: "requiredProducts" | "remark";
		metadata: Company;
	};
}

/**
 * 向量化公司数据脚本
 * 从 text2sql_companies 表中提取 requiredProducts19978277361 和 remark 字段
 * 对这些字段进行向量化并存储到 Qdrant
 */
async function vectorizeCompanies() {
	console.log("🚀 开始向量化公司数据...");

	try {
		// 1. 检查并创建 Qdrant 集合
		const collectionName = env.QDRANT_DEFAULT_COLLECTION;
		const collectionExists =
			await qdrantService.collectionExists(collectionName);

		if (!collectionExists) {
			console.log(`📦 创建 Qdrant 集合: ${collectionName}`);
			await qdrantService.createCollection(collectionName, {
				vectors: {
					size: env.EMBEDDING_DIMENSION,
					distance: "Cosine",
				},
				optimizers_config: {
					default_segment_number: 2,
				},
				replication_factor: 1,
			});

			// 创建索引以提高查询性能
			await qdrantService.createPayloadIndex(collectionName, {
				field_name: "fieldType",
				field_schema: "keyword",
			});

			await qdrantService.createPayloadIndex(collectionName, {
				field_name: "companyId",
				field_schema: "integer",
			});

			await qdrantService.createPayloadIndex(collectionName, {
				field_name: "companyName",
				field_schema: "text",
			});
		} else {
			console.log(`✅ Qdrant 集合 ${collectionName} 已存在`);
		}

		// 2. 从数据库获取所有公司数据
		console.log("📊 从数据库获取公司数据...");
		const companiesData = await db
			.select()
			.from(companies)
			.orderBy(desc(companies.id));

		console.log(`📈 找到 ${companiesData.length} 家公司`);

		// 3. 准备向量化数据
		const vectorDataList: CompanyVectorData[] = [];
		let processedCount = 0;
		let skippedCount = 0;

		for (const company of companiesData) {
			const textsToVectorize: {
				text: string;
				fieldType: "requiredProducts" | "remark";
			}[] = [];

			// 检查 requiredProducts19978277361 字段
			if (company.requiredProducts19978277361?.trim()) {
				textsToVectorize.push({
					text: company.requiredProducts19978277361.trim(),
					fieldType: "requiredProducts",
				});
			}

			// 检查 remark 字段
			if (company.remark?.trim()) {
				textsToVectorize.push({
					text: company.remark.trim(),
					fieldType: "remark",
				});
			}

			// 如果没有可向量化的文本，跳过这家公司
			if (textsToVectorize.length === 0) {
				skippedCount++;
				continue;
			}

			// 对每个文本字段进行向量化
			for (const textData of textsToVectorize) {
				try {
					console.log(
						`🔄 向量化公司: ${company.name} - 字段: ${textData.fieldType}`,
					);

					// 生成嵌入向量
					const embedding = await embedText(textData.text);

					if (embedding) {
						// 使用数值ID: companyId * 10 + fieldType索引 (0=requiredProducts, 1=remark)
						const fieldTypeIndex =
							textData.fieldType === "requiredProducts" ? 0 : 1;
						const numericId = company.companyId * 10 + fieldTypeIndex;

						const vectorData: CompanyVectorData = {
							id: numericId, // 直接使用数值ID
							vector: embedding,
							payload: {
								text: textData.text,
								fieldType: textData.fieldType,
								metadata: company,
							},
						};

						vectorDataList.push(vectorData);
						processedCount++;

						// 每处理10条记录就批量写入，避免内存过大
						if (vectorDataList.length >= 10) {
							await batchUpsertToQdrant(collectionName, vectorDataList);
							vectorDataList.length = 0; // 清空数组
						}

						// 添加延迟以避免API速率限制
						await new Promise((resolve) => setTimeout(resolve, 100));
					}
				} catch (error) {
					console.error(
						`❌ 向量化失败 - 公司: ${company.name}, 字段: ${textData.fieldType}`,
						error,
					);
				}
			}
		}

		// 处理剩余的向量数据
		if (vectorDataList.length > 0) {
			await batchUpsertToQdrant(collectionName, vectorDataList);
		}

		console.log("✅ 向量化完成！");
		console.log("📊 统计信息:");
		console.log(`   - 总公司数: ${companiesData.length}`);
		console.log(`   - 处理记录: ${processedCount}`);
		console.log(`   - 跳过记录: ${skippedCount}`);
		const totalProcessed = processedCount + skippedCount;
		const successRate =
			totalProcessed > 0
				? ((processedCount / totalProcessed) * 100).toFixed(2)
				: "0";
		console.log(`   - 成功率: ${successRate}%`);
	} catch (error) {
		console.error("❌ 向量化过程中发生错误:", error);
		throw error;
	}
}

/**
 * 批量写入向量数据到 Qdrant
 */
async function batchUpsertToQdrant(
	collectionName: string,
	vectorDataList: CompanyVectorData[],
) {
	if (vectorDataList.length === 0) return;

	try {
		console.log(`📤 批量写入 ${vectorDataList.length} 条向量数据到 Qdrant...`);

		const points = vectorDataList.map((data) => ({
			id: data.id,
			vector: data.vector,
			payload: data.payload,
		}));

		await qdrantService.upsertPoints(collectionName, points, true);
		console.log(`✅ 成功写入 ${vectorDataList.length} 条记录`);
	} catch (error) {
		console.error("❌ 批量写入 Qdrant 失败:", error);
		throw error;
	}
}

/**
 * 测试向量化搜索功能
 */
async function testVectorSearch() {
	console.log("\n🔍 测试向量化搜索功能...");

	try {
		const searchResults = await qdrantService.hybridSearch({
			collectionName: env.QDRANT_DEFAULT_COLLECTION,
			query: "LED灯具照明产品",
			keywordFields: ["text"],
			filter: {
				fieldType: "requiredProducts",
			},
			limit: 5,
			scoreNormalization: "percentage",
			candidateMultiplier: 2,
			useShould: false,
		});

		console.log(`🎯 搜索结果 (共 ${searchResults.results.length} 条):`);
		for (const result of searchResults.results) {
			console.log(`   - 公司: ${result.payload.companyName}`);
			console.log(`   - 字段类型: ${result.payload.fieldType}`);
			console.log(`   - 相关度: ${(result.score * 100).toFixed(2)}%`);
			console.log(`   - 内容: ${result.payload.text.substring(0, 100)}...`);
			console.log("   ---");
		}
	} catch (error) {
		console.error("❌ 搜索测试失败:", error);
	}
}

// 主函数
async function main() {
	console.log("🎯 公司数据向量化脚本");
	console.log("=".repeat(50));

	try {
		await vectorizeCompanies();
		await testVectorSearch();

		console.log("\n🎉 脚本执行完成！");
		process.exit(0);
	} catch (error) {
		console.error("💥 脚本执行失败:", error);
		process.exit(1);
	}
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
	main();
}

export { vectorizeCompanies, testVectorSearch };
