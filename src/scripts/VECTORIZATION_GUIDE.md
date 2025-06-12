# 向量化指南

## 概述

本项目使用 Qdrant 进行向量搜索。向量化是将文本数据转换为高维向量的过程，使得语义相似的文本在向量空间中距离较近。

## 集合命名策略

为了支持不同表具有不同的向量字段结构，系统为每个表创建独立的 Qdrant 集合：

- 基础集合名：从环境变量 `QDRANT_DEFAULT_COLLECTION` 获取（如 `zetar-demo`）
- 表专属集合名：`{基础集合名}-{表名}`

例如：
- companies 表 → `zetar-demo-companies`
- contacts 表 → `zetar-demo-contacts`
- follow_ups 表 → `zetar-demo-follow_ups`

这种设计允许每个表有不同数量和类型的向量字段，避免结构冲突。

## 自动向量化

### 标记字段

在数据库 schema 中，通过 `isVectorized: true` 标记需要向量化的字段：

```typescript
// src/server/db/schema/companies.ts
export const companies = pgTable("text2sql_companies", {
  name: varchar("name", { length: 500 })
    .notNull()
    .default("")
    .$annotations({ 
      description: "公司全称",
      isVectorized: true  // 标记为向量化字段
    }),
  // ... 其他字段
});
```

### 运行向量化

有三种方式运行向量化：

#### 1. 自动向量化所有标记字段的所有表（推荐）

```bash
# 测试并查看将要向量化的字段
bun run src/scripts/test-vectorize-all.ts

# 执行实际的向量化 - 方式1：使用专门的脚本
bun run src/scripts/vectorize-all-tables.ts

# 执行实际的向量化 - 方式2：使用主脚本
bun run src/scripts/vectorize-all.ts
```

#### 2. 自动向量化特定表的所有标记字段

```typescript
import { vectorizeCompaniesAuto } from "./vectorize-all";

// 只向量化 companies 表的所有标记字段
await vectorizeCompaniesAuto();
```

#### 3. 手动向量化特定表的特定字段

```typescript
import { universalVectorize } from "./universal-vectorizer";
import { companies } from "../server/db/schema";

await universalVectorize({
  tableName: "companies",
  tableSchema: companies,
  collectionName: process.env.QDRANT_DEFAULT_COLLECTION,
  idField: "companyId",
  textFields: ["name", "remark", "requiredProducts19978277361"],
  batchSize: 100
});
```

## 向量化字段列表

当前标记为向量化的字段：

| 表名 | 字段 | 说明 |
|-----|------|------|
| companies | name | 公司全称 |
| companies | shortName | 公司简称 |
| companies | remark | 客户备注 |
| companies | searchKeywords7375691812971 | 搜索关键词 |
| companies | mainBusiness7375678270531 | 主营业务 |
| companies | inquiryKeywords22467658539 | 询盘关键词 |
| companies | requiredProducts19978277361 | 需求产品 |
| contacts | name | 联系人姓名 |
| contacts | remark | 联系人备注 |
| follow_ups | content | 跟进内容 |
| opportunities | name | 商机名称 |
| opportunities | remark | 商机备注 |
| whatsapp_messages | body | 消息内容 |

## 工作原理

1. **字段识别**：`generateJsonSchema` 函数扫描所有表定义，提取标记为 `isVectorized` 的字段
2. **批量处理**：每批处理 100 条记录，避免内存溢出
3. **文本组合**：将多个字段组合成单个文本进行向量化
4. **断点续传**：支持中断后继续处理，避免重复工作
5. **向量存储**：所有向量存储在同一个 Qdrant 集合中，通过 metadata 区分来源

## 性能优化

- **批处理**：减少数据库查询次数
- **并行处理**：多个字段同时向量化
- **跳过空值**：自动跳过空字段，节省计算资源
- **断点续传**：大数据集可以分多次运行

## 故障排除

### 常见问题

1. **内存不足**
   - 减小 `batchSize` 参数
   - 分表运行而不是一次性运行所有表

2. **Qdrant 连接失败**
   - 检查环境变量配置
   - 确认 Qdrant 服务正在运行

3. **字段未被识别**
   - 确认字段标记了 `isVectorized: true`
   - 运行测试脚本验证字段识别

4. **409 Conflict 错误（集合已存在）**
   - 脚本已自动处理，会使用断点续传模式
   - 如需重新开始，先运行清理脚本：`bun run src/scripts/clean-qdrant.ts`

5. **搜索时出现 Bad Request 错误**
   - 某些字段虽然标记了 `isVectorized`，但在实际向量化时因数据为空被跳过
   - 搜索脚本已自动处理，只搜索实际存在的向量字段
   - 被跳过的字段会在搜索结果中明确显示

### 清理和重置

如果需要清理 Qdrant 集合并重新开始：

```bash
# 清理特定表的集合
bun run src/scripts/clean-qdrant.ts zetar-demo-companies
bun run src/scripts/clean-qdrant.ts zetar-demo-contacts

# 清理所有表的集合（需要手动清理每个表）
bun run src/scripts/clean-all-qdrant.ts

# 清理后重新向量化
bun run src/scripts/vectorize-all.ts
```

### 日志说明

- 🔍 分析阶段：识别向量化字段
- 📋 处理阶段：正在处理特定表
- ✅ 成功标记：表处理完成
- ❌ 错误标记：处理失败，查看错误信息
- 📊 统计信息：处理结果汇总

## 可用工具

### 向量化工具

```bash
# 查看将要向量化的字段
bun run src/scripts/test-vectorize-all.ts

# 执行向量化
bun run src/scripts/vectorize-all.ts

# 检查向量化状态（查看哪些字段被跳过）
bun run src/scripts/check-vector-fields.ts
```

### 搜索测试工具

```bash
# 测试所有表的搜索功能
bun run src/scripts/test-table-search.ts

# 测试特定查询
bun run src/scripts/test-table-search.ts "你的查询内容"
```

### 清理工具

```bash
# 清理特定集合
bun run src/scripts/clean-qdrant.ts collection-name

# 清理所有表的集合
bun run src/scripts/clean-all-qdrant.ts
```

## 扩展开发

### 添加新的向量化字段

1. 在 schema 定义中添加 `isVectorized: true`
2. 运行 `bun run src/scripts/test-vectorize-all.ts` 验证
3. 运行向量化脚本更新向量数据库

### 自定义向量化逻辑

如需特殊的文本预处理，可以扩展 `universalVectorize` 函数：

```typescript
await universalVectorize({
  // ... 基本配置
  preprocessText: (text: string) => {
    // 自定义文本预处理逻辑
    return text.toLowerCase().trim();
  }
});
``` 