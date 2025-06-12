import { embedText } from "@/lib/embed-text";
import { qdrantService } from "@/lib/qdrant/service";

export const validateVectorizeCompanies = async (
	collectionName: string,
	query: string,
) => {
	try {
		// 生成搜索向量
		const searchQuery = query;
		const searchVector = await embedText(searchQuery);

		if (searchVector) {
			// 测试 1: 2025年最佳实践单向量搜索
			console.log("\n🔎 测试优化搜索...");
			try {
				const searchResults = await qdrantService.search(collectionName, {
					vectorName: "requiredProducts19978277361",
					vector: searchVector,
					limit: 5,
					withPayload: true,
					withVectors: false,
					hnswEf: 256, // 更高的ef值
					oversampling: 3.0, // 3倍过采样
					rescore: true, // 启用重新评分
				});

				console.log("📋 优化搜索结果:");
				console.log(`  找到 ${searchResults.length} 个相关结果`);

				for (const [index, result] of searchResults.entries()) {
					console.log(`\n  结果 ${index + 1}:`);
					console.log(`    公司ID: ${result.payload?.companyId}`);
					console.log(`    公司名称: ${result.payload?.name}`);
					console.log(`    评分: ${result.score}`);
					const productText = result.payload
						?.requiredProducts19978277361 as string;
					console.log(
						`    需求产品: ${productText?.substring(0, 100) || "无"}...`,
					);
				}
			} catch (searchError) {
				console.log("⚠️  搜索测试失败:", searchError);
			}

			// 测试 2: 智能批量搜索
			console.log("\n🚀 测试智能批量搜索...");
			try {
				const batchResults = await qdrantService.searchBatch(
					collectionName,
					[
						{
							vectorName: "requiredProducts19978277361",
							vector: searchVector,
							limit: 3,
							withPayload: true,
							withVectors: false,
						},
						{
							vectorName: "remark",
							vector: searchVector,
							limit: 3,
							withPayload: true,
							withVectors: false,
						},
					],
					{
						optimizeFor: "balanced", // 平衡速度和精度
						adaptiveEf: true, // 启用自适应ef值
						useQuantization: true, // 使用量化
					},
				);

				console.log("📋 智能批量搜索结果:");
				console.log(`  批量搜索返回 ${batchResults.length} 个结果集`);

				for (const [batchIndex, results] of batchResults.entries()) {
					const vectorName =
						batchIndex === 0 ? "requiredProducts19978277361" : "remark";
					console.log(`\n  ${vectorName} 向量搜索结果 (${results.length} 个):`);

					for (const [index, result] of results.entries()) {
						console.log(
							`    结果 ${index + 1}: 公司${result.payload?.companyId} - ${result.payload?.name} (评分: ${result.score})`,
						);
					}
				}
			} catch (batchError) {
				console.log("⚠️  智能批量搜索测试失败:", batchError);
			}

			// 测试 3: 高速搜索模式
			console.log("\n⚡ 测试高速搜索模式...");
			try {
				const speedResults = await qdrantService.searchBatch(
					collectionName,
					[
						{
							vectorName: "requiredProducts19978277361",
							vector: searchVector,
							limit: 5,
							withPayload: true,
							withVectors: false,
						},
					],
					{
						optimizeFor: "speed", // 优化速度
						adaptiveEf: true,
						useQuantization: true,
					},
				);

				console.log("📋 高速搜索结果:");
				if (speedResults.length > 0) {
					const results = speedResults[0];
					if (results && Array.isArray(results)) {
						console.log(`  找到 ${results.length} 个快速结果`);

						for (const [index, result] of results.entries()) {
							console.log(`\n  结果 ${index + 1}:`);
							console.log(`    公司ID: ${result.payload?.companyId}`);
							console.log(`    公司名称: ${result.payload?.name}`);
							console.log(`    速度评分: ${result.score}`);
							const productText = result.payload
								?.requiredProducts19978277361 as string;
							console.log(
								`    需求产品: ${productText?.substring(0, 80) || "无"}...`,
							);
						}
					}
				}
			} catch (speedError) {
				console.log("⚠️  高速搜索测试失败:", speedError);
			}
		} else {
			console.log("❌ 无法生成搜索向量");
		}
	} catch (searchError) {
		console.error("❌ 搜索测试失败:", searchError);
	}
};
