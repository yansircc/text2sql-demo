# 查询处理管道设计

## 概述

本系统采用多步骤管道设计，通过逐步精简上下文和明确职责分离，实现高效准确的自然语言到 SQL 转换。

## 管道步骤

### 1. Pre-Handle（预处理）
**职责**：快速路由和表识别
- **输入**：用户查询 + 完整数据库 schema
- **处理**：
  - 判断查询清晰度
  - 识别语义搜索需求
  - 确定涉及的表（不分析字段）
- **输出**：
  - 表列表（带置信度）
  - 处理决策（同步/异步/需要补充信息）

### 2. Pre-SQL（SQL 准备）
**职责**：字段选择和 SQL 提示生成
- **输入**：用户查询 + 仅相关表的 schema（已精简）
- **处理**：
  - 从预选表中选择必要字段
  - 生成 SQL 构建步骤
  - 生成 SQL 提示（排序、分组、聚合等）
- **输出**：
  - 精确的表字段选择
  - SQL 生成提示

### 3. Slim Schema（Schema 精简）
**职责**：生成最小化的 schema
- **输入**：选中的表和字段列表
- **处理**：从完整 schema 中提取所需部分
- **输出**：仅包含必要表和字段的精简 schema

### 4. Gen-SQL（SQL 生成）
**职责**：生成最终 SQL
- **输入**：PreSQL 结果 + 精简 schema
- **处理**：基于明确指令生成 SQL
- **输出**：可执行的 SQL 语句

## 数据流示例

查询："显示今天创建的订单"

### Step 1: Pre-Handle
```json
输入: {
  "query": "显示今天创建的订单",
  "databaseSchema": "... 20个表的完整schema ..."
}

输出: {
  "tables": [{"tableName": "orders", "confidence": 0.95}],
  "decision": {"action": "proceed_sync"}
}
```

### Step 2: Pre-SQL
```json
输入: {
  "query": "显示今天创建的订单",
  "databaseSchema": "... 仅orders表的schema ...",
  "preHandleInfo": {"selectedTables": ["orders"]}
}

输出: {
  "selectedTables": [{
    "tableName": "orders",
    "fields": ["id", "user_id", "amount", "status", "created_at"]
  }],
  "timeRange": "2024-01-17 00:00:00 到 2024-01-17 23:59:59",
  "sqlHints": {
    "orderBy": [{"field": "created_at", "direction": "DESC"}],
    "timeFieldHints": [{
      "field": "created_at",
      "dataType": "integer",
      "format": "timestamp"
    }]
  }
}
```

### Step 3: Slim Schema
```json
输入: Pre-SQL的selectedTables

输出: {
  "orders": {
    "properties": {
      "id": {...},
      "user_id": {...},
      "amount": {...},
      "status": {...},
      "created_at": {...}
    }
  }
}
```

### Step 4: Gen-SQL
```json
输入: PreSQL结果 + 精简schema

输出: {
  "sql": "SELECT id, user_id, amount, status, created_at FROM orders WHERE created_at >= strftime('%s', 'now', 'start of day') AND created_at < strftime('%s', 'now', 'start of day', '+1 day') ORDER BY created_at DESC"
}
```

## 优势

1. **上下文精简**：
   - 20张表 → 1张表 → 5个字段
   - 上下文减少 95%+

2. **职责明确**：
   - 每个步骤专注单一任务
   - 易于调试和优化

3. **灵活性**：
   - 可以在任何步骤中断（如需要用户补充信息）
   - 支持异步处理复杂查询

4. **准确性**：
   - 精简的上下文减少 AI 的"幻觉"
   - 明确的指令而非推理

5. **效率**：
   - 前期步骤使用轻量模型
   - 并行处理可能性 