# 2025年混合搜索最佳实践示例

## 概述

本文档展示了重构后的 `pre-handle.ts` 如何实现智能查询路由，根据查询特征选择最优的处理路径。

## 核心原则

1. **优先SQL模糊查询**：如果可以通过 LIKE 解决，不使用向量搜索
2. **快速失败**：不可行、不清晰或过于复杂的查询直接返回
3. **并行处理**：混合搜索时向量搜索和SQL查询并行执行
4. **智能融合**：使用 RRF (Reciprocal Rank Fusion) 融合结果

## 查询类型示例

### 1. 纯SQL查询 (sql_only)

**查询**: "查找名称包含'科技'的公司"

**处理流程**:
```
pre-handle → 判断为 sql_only → pre-sql → gen-sql → run-sql
```

**SQL示例**:
```sql
SELECT * FROM companies 
WHERE name LIKE '%科技%' 
ORDER BY name;
```

### 2. 纯向量搜索 (vector_only)

**查询**: "寻找做类似云计算业务的企业"

**处理流程**:
```
pre-handle → 判断为 vector_only → 执行向量搜索 → 直接返回结果
```

**特点**:
- 需要语义理解（"类似"意味着相似而非精确匹配）
- 直接返回向量搜索结果，不进入SQL流程
- 响应速度快

### 3. 混合搜索 (hybrid)

**查询**: "大型企业中提供AI解决方案的公司"

**处理流程**:
```
pre-handle → 判断为 hybrid → 并行执行:
  ├─ 向量搜索（搜索"AI解决方案"）
  └─ SQL准备（筛选"大型企业"）
→ RRF融合结果
```

**混合策略**:
- 向量搜索：理解"AI解决方案"的语义含义
- SQL查询：精确筛选大型企业（如员工数>1000）
- RRF融合：结合两种搜索的结果

## RRF融合算法

```typescript
// RRF公式: score = Σ(1 / (k + rank))
// k通常为60，用于平滑排名差异

const rrfScore = (rank: number, k: number = 60) => 1 / (k + rank);

// 融合示例
vectorResult: { companyId: 1, rank: 1 }  // RRF分数: 1/61
sqlResult: { companyId: 1, rank: 3 }     // RRF分数: 1/63
// 公司1的总分: 1/61 + 1/63 = 0.0328
```

## 速度优化

### 并行处理优势

传统串行处理:
```
向量搜索(300ms) → SQL生成(200ms) → SQL执行(100ms) = 600ms
```

优化后并行处理:
```
向量搜索(300ms) ─┐
                  ├─ 融合(50ms) = 350ms
SQL流程(300ms) ──┘
```

**节省时间**: 250ms (41.7%)

## 配置选项

### 1. 搜索权重调整

```typescript
hybridStrategy: {
  fusionMethod: "rrf",
  weightVector: 0.7,  // 增加语义搜索权重
  weightSQL: 0.3      // 降低SQL搜索权重
}
```

### 2. 结果数量控制

```typescript
vectorQuery: {
  expectedResultCount: 20  // 向量搜索返回更多结果
}
```

### 3. 融合方法选择

- `rrf`: 基于排名的融合（推荐）
- `weighted`: 基于分数的加权融合
- `keyword_first`: 关键词优先，语义补充

## 错误处理

### 快速失败场景

1. **不可行查询**
   ```
   查询: "今天的天气怎么样"
   返回: { action: "not_feasible", reason: "查询超出数据库范围" }
   ```

2. **需要澄清**
   ```
   查询: "最近的订单"
   返回: { action: "request_clarification", missingInfo: ["时间范围"] }
   ```

3. **过于复杂**
   ```
   查询: "分析5个表的关联数据"
   返回: { action: "too_many_tables", suggestion: "请简化查询" }
   ```

## 最佳实践建议

1. **查询优化**
   - 尽量使用具体的关键词，便于SQL模糊匹配
   - 语义查询时使用描述性语言

2. **性能考虑**
   - 向量搜索适合小结果集（<100条）
   - 大数据集优先考虑SQL过滤后再语义排序

3. **结果质量**
   - 调整权重以平衡精确性和召回率
   - 监控RRF融合的效果，必要时调整k值

## 实施检查清单

- [ ] 向量索引已建立并优化
- [ ] SQL表已建立适当的索引
- [ ] 模糊查询模式已测试性能
- [ ] RRF参数已根据业务需求调整
- [ ] 错误处理逻辑已完善
- [ ] 并行处理的超时机制已设置 