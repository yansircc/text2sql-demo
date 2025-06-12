import { env } from "../env";
import { batchEmbedTexts, embedText } from "../lib/embed-text";
import type { PointData } from "../lib/qdrant/schema";
import { qdrantService } from "../lib/qdrant/service";
import { db } from "../server/db";

/**
 * 2025年最佳实践：通用向量化器
 * 支持任意数据库表的文本字段自动向量化
 */

interface VectorizerConfig {
	tableName: string; // 表名
	tableSchema: any; // Drizzle schema对象
	collectionName: string; // Qdrant集合名
	idField: string; // 主键字段名
	textFields: string[]; // 要向量化的文本字段列表
	limit?: number; // 处理记录数限制，undefined表示不限量
	batchSize?: number; // 写入批次大小
	resumeMode?: boolean; // 是否启用断点续传模式
	skipExisting?: boolean; // 是否跳过已存在的记录
}

interface TextFieldMapping {
	recordIndex: number;
	fieldName: string;
	textIndex: number;
}

interface UniversalVectorData extends PointData {
	payload: Record<string, unknown>;
}

/**
 * 检测字段是否为文本类型
 */
function isTextField(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * 自动检测表中的文本字段
 */
async function detectTextFields(
	tableSchema: any,
	sampleData: Record<string, unknown>[],
): Promise<string[]> {
	if (sampleData.length === 0) return [];

	const textFields: string[] = [];
	const sampleRecord = sampleData[0];

	for (const [fieldName, value] of Object.entries(sampleRecord || {})) {
		// 跳过主键和系统字段
		if (
			fieldName.toLowerCase().includes("id") ||
			fieldName.toLowerCase().includes("created") ||
			fieldName.toLowerCase().includes("updated")
		) {
			continue;
		}

		// 检查是否为文本字段
		if (isTextField(value)) {
			// 检查多个样本确认字段类型
			const isConsistentlyText = sampleData
				.slice(0, Math.min(5, sampleData.length))
				.every(
					(record) =>
						record[fieldName] === null ||
						record[fieldName] === undefined ||
						isTextField(record[fieldName]),
				);

			if (isConsistentlyText) {
				textFields.push(fieldName);
			}
		}
	}

	return textFields;
}

/**
 * 获取集合中已存在的所有记录ID
 */
async function getExistingIds(
	collectionName: string,
): Promise<Set<string | number>> {
	const existingIds: Set<string | number> = new Set();

	try {
		// 使用scroll API获取所有点的ID
		let nextPageOffset: string | undefined;
		let totalFetched = 0;

		console.log("🔍 获取已存在的记录ID...");

		do {
			const scrollResult = await qdrantService
				.getClient()
				.scroll(collectionName, {
					limit: 100,
					offset: nextPageOffset,
					with_payload: false,
					with_vector: false,
				});

			if (scrollResult.points) {
				for (const point of scrollResult.points) {
					existingIds.add(point.id);
				}
				totalFetched += scrollResult.points.length;
			}

			nextPageOffset = scrollResult.next_page_offset
				? String(scrollResult.next_page_offset)
				: undefined;

			if (totalFetched % 1000 === 0 && totalFetched > 0) {
				console.log(`  已获取 ${totalFetched} 个现有ID...`);
			}
		} while (nextPageOffset);

		console.log(`✅ 获取完成，共找到 ${existingIds.size} 个已存在的记录`);
	} catch (error) {
		console.log("⚠️  获取已存在ID失败:", error);
	}

	return existingIds;
}

/**
 * 通用向量化函数
 */
async function universalVectorize(config: VectorizerConfig) {
	console.log("🚀 开始通用向量化处理");
	console.log("=".repeat(60));
	console.log(`📋 表名: ${config.tableName}`);
	console.log(`📦 集合名: ${config.collectionName}`);
	console.log(`🔑 主键字段: ${config.idField}`);
	console.log(`📝 指定文本字段: ${config.textFields.join(", ")}`);

	const {
		tableSchema,
		collectionName,
		idField,
		textFields,
		limit, // 不设默认值，undefined表示不限量
		batchSize = 10,
		resumeMode = false,
		skipExisting = false,
	} = config;

	try {
		// 1. 检查并创建集合（支持断点续传）
		const exists = await qdrantService.collectionExists(collectionName);
		const existingIds: Set<string | number> = new Set();

		if (exists) {
			if (resumeMode || skipExisting) {
				console.log("🔄 检测到现有集合，启用断点续传模式");
				// 获取已存在的记录ID列表
				try {
					const collection = await qdrantService.getCollection(collectionName);
					console.log(`📊 现有集合包含 ${collection.points_count} 个向量点`);

					// 获取所有已存在的ID
					const fetchedIds = await getExistingIds(collectionName);
					for (const id of fetchedIds) {
						existingIds.add(id);
					}
				} catch (error) {
					console.log("⚠️  获取现有记录失败，将重新创建集合");
					await qdrantService.deleteCollection(collectionName);
				}
			} else {
				console.log("🗑️  删除现有集合:", collectionName);
				await qdrantService.deleteCollection(collectionName);
			}
		}

		// 2. 获取数据样本进行字段检测
		console.log("\n📊 获取数据样本...");
		const sampleLimit = limit ? Math.min(10, limit) : 10;
		const sampleData = await db.select().from(tableSchema).limit(sampleLimit);

		if (sampleData.length === 0) {
			throw new Error("数据表为空");
		}

		console.log(`✅ 获取到 ${sampleData.length} 条样本数据`);

		// 3. 自动检测或验证文本字段
		let finalTextFields: string[];
		if (textFields.length === 0) {
			console.log("\n🔍 自动检测文本字段...");
			finalTextFields = await detectTextFields(tableSchema, sampleData);
			console.log(`📝 检测到文本字段: ${finalTextFields.join(", ")}`);
		} else {
			// 验证指定的字段是否存在且为文本类型
			finalTextFields = textFields.filter((field) => {
				const firstRecord = sampleData[0];
				if (!firstRecord) return false;

				const exists = field in firstRecord;
				const isText = exists && isTextField(firstRecord[field]);
				if (!exists) {
					console.log(`⚠️  字段 ${field} 不存在，跳过`);
				} else if (!isText) {
					console.log(`⚠️  字段 ${field} 不是文本类型，跳过`);
				}
				return exists && isText;
			});
		}

		if (finalTextFields.length === 0) {
			throw new Error("没有找到可向量化的文本字段");
		}

		// 4. 创建集合配置
		const vectorsConfig: Record<string, { size: number; distance: "Cosine" }> =
			{};
		for (const field of finalTextFields) {
			vectorsConfig[field] = {
				size: Number(env.EMBEDDING_DIMENSION),
				distance: "Cosine",
			};
		}

		// 只有在集合不存在时才创建
		if (!exists || (!resumeMode && !skipExisting)) {
			console.log("\n📁 创建向量集合...");
			await qdrantService.createCollection(collectionName, {
				vectors: vectorsConfig,
			});
			console.log(`✅ 创建集合成功，包含 ${finalTextFields.length} 个向量字段`);
		} else {
			console.log(`\n📁 使用现有集合: ${collectionName}`);
			console.log(`  配置向量字段: ${finalTextFields.join(", ")}`);
		}

		// 5. 获取全部数据
		console.log("\n📊 获取全部数据...");
		const query = db.select().from(tableSchema);

		// 只有设置了limit才应用限制
		const allData = limit ? await query.limit(limit) : await query;

		console.log(
			`✅ 获取到 ${allData.length} 条记录${limit ? ` (限制: ${limit})` : " (无限制)"}`,
		);

		// 6. 收集所有需要向量化的文本
		console.log("\n🚀 准备批量向量化...");
		const allTexts: string[] = [];
		const textMapping: TextFieldMapping[] = [];

		for (const [recordIndex, record] of allData.entries()) {
			for (const fieldName of finalTextFields) {
				const fieldValue = record[fieldName];
				if (isTextField(fieldValue)) {
					allTexts.push(fieldValue as string);
					textMapping.push({
						recordIndex,
						fieldName,
						textIndex: allTexts.length - 1,
					});
				}
			}
		}

		console.log(`📝 总共收集到 ${allTexts.length} 个文本需要向量化`);

		// 7. 批量向量化
		let allEmbeddings: number[][] = [];
		if (allTexts.length > 0) {
			console.log("🔄 执行批量向量化...");
			const embeddings = await batchEmbedTexts(allTexts);
			if (embeddings && embeddings.length === allTexts.length) {
				allEmbeddings = embeddings;
				console.log(`✅ 批量向量化完成！生成 ${allEmbeddings.length} 个向量`);
			} else {
				throw new Error("批量向量化失败");
			}
		}

		// 8. 构建向量数据
		console.log("\n🔧 构建向量数据...");
		const vectorData: UniversalVectorData[] = [];
		let successCount = 0;
		let skipCount = 0;
		let resumeSkipCount = 0;

		for (const [recordIndex, record] of allData.entries()) {
			const recordId = record[idField] as string | number;

			// 断点续传：跳过已存在的记录
			if ((resumeMode || skipExisting) && existingIds.has(recordId)) {
				resumeSkipCount++;
				if (recordIndex % 100 === 0) {
					console.log(
						`  ⏭️  跳过已存在记录 ${recordIndex + 1}/${allData.length}: ID ${recordId}`,
					);
				}
				continue;
			}

			const vectors: Record<string, number[]> = {};
			let hasAnyVector = false;

			// 从批量结果中获取对应的向量
			for (const mapping of textMapping) {
				if (mapping.recordIndex === recordIndex) {
					const embedding = allEmbeddings[mapping.textIndex];
					if (embedding) {
						vectors[mapping.fieldName] = embedding;
						hasAnyVector = true;
					}
				}
			}

			// 如果有任何向量，添加到数据中
			if (hasAnyVector) {
				// 构建payload，包含所有原始数据
				const payload: Record<string, unknown> = { ...record };

				// 添加向量字段信息
				for (const fieldName of finalTextFields) {
					payload[`has_${fieldName}_vector`] = !!vectors[fieldName];
				}

				vectorData.push({
					id: recordId,
					vectors,
					payload,
				});

				successCount++;
				if (recordIndex % 10 === 0) {
					console.log(
						`  ✅ 处理记录 ${recordIndex + 1}/${allData.length}: ID ${recordId}`,
					);
				}
			} else {
				skipCount++;
			}
		}

		// 9. 批量写入 Qdrant
		console.log("\n📤 批量写入向量数据...");
		console.log(`  成功处理: ${successCount} 条记录`);
		console.log(`  跳过无效: ${skipCount} 条记录`);
		if (resumeSkipCount > 0) {
			console.log(`  跳过已存在: ${resumeSkipCount} 条记录`);
		}
		console.log(`  总计向量点: ${vectorData.length} 个`);

		if (vectorData.length > 0) {
			for (let i = 0; i < vectorData.length; i += batchSize) {
				const batch = vectorData.slice(i, i + batchSize);
				const batchNum = Math.floor(i / batchSize) + 1;
				const totalBatches = Math.ceil(vectorData.length / batchSize);

				console.log(`\n📦 写入批次 ${batchNum}/${totalBatches}`);
				await qdrantService.upsertPoints(collectionName, batch, true);
				console.log(`  ✅ 批次写入完成 (${batch.length} 个点)`);
			}

			console.log("\n🎉 所有数据写入完成！");
		} else {
			console.log("\n⚠️  没有向量数据需要写入");
		}

		// 10. 验证结果
		console.log("\n🔍 验证集合状态...");
		const collection = await qdrantService.getCollection(collectionName);
		console.log(`  向量点数量: ${collection.points_count}`);
		console.log(`  向量字段数量: ${Object.keys(vectorsConfig).length}`);
		console.log(`  向量字段名称: ${Object.keys(vectorsConfig).join(", ")}`);

		return {
			success: true,
			collectionName,
			processedRecords: successCount,
			skippedRecords: skipCount,
			resumeSkippedRecords: resumeSkipCount,
			vectorFields: finalTextFields,
			plannedFields: textFields,
			totalVectors: allEmbeddings.length,
			totalRecordsProcessed: allData.length,
		};
	} catch (error) {
		console.error("❌ 向量化过程出错:", error);
		throw error;
	}
}

/**
 * 通用搜索测试函数
 */
async function testUniversalSearch(
	collectionName: string,
	vectorFields: string[],
	query: string,
) {
	console.log("\n🔎 测试通用向量搜索...");
	console.log(`🔍 查询: "${query}"`);

	try {
		const searchVector = await embedText(query);
		if (!searchVector) {
			console.log("❌ 无法生成搜索向量");
			return;
		}

		// 测试每个向量字段
		for (const fieldName of vectorFields) {
			console.log(`\n📋 搜索字段: ${fieldName}`);

			try {
				const results = await qdrantService.search(collectionName, {
					vectorName: fieldName,
					vector: searchVector,
					limit: 3,
					withPayload: true,
					withVectors: false,
					hnswEf: 128,
				});

				console.log(`  找到 ${results.length} 个相关结果:`);

				for (const [index, result] of results.entries()) {
					console.log(
						`    结果 ${index + 1}: ID ${result.id}, 评分: ${result.score}`,
					);

					// 显示相关字段内容
					const fieldValue = result.payload?.[fieldName] as string;
					if (fieldValue) {
						const preview =
							fieldValue.substring(0, 50) +
							(fieldValue.length > 50 ? "..." : "");
						console.log(`      ${fieldName}: ${preview}`);
					}
				}
			} catch (searchError) {
				console.log(`  ⚠️  搜索字段 ${fieldName} 失败:`, searchError);
			}
		}

		// 测试批量搜索
		if (vectorFields.length > 1) {
			console.log("\n📋 批量搜索所有字段");

			try {
				const batchSearches = vectorFields.map((fieldName) => ({
					vectorName: fieldName,
					vector: searchVector,
					limit: 2,
					withPayload: true,
					withVectors: false,
					hnswEf: 128,
				}));

				const batchResults = await qdrantService.searchBatch(
					collectionName,
					batchSearches,
				);

				console.log(`  批量搜索返回 ${batchResults.length} 个结果集`);

				for (const [batchIndex, results] of batchResults.entries()) {
					const fieldName = vectorFields[batchIndex];
					console.log(`    ${fieldName}: ${results.length} 个结果`);
				}
			} catch (batchError) {
				console.log(`  ⚠️  批量搜索失败: ${batchError}`);
			}
		}
	} catch (error) {
		console.error("❌ 搜索测试失败:", error);
	}
}

export {
	universalVectorize,
	testUniversalSearch,
	type VectorizerConfig,
	detectTextFields,
	isTextField,
};
