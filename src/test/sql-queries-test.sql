-- CRM系统 SQL查询测试集
-- 基于schema.ts中定义的表结构设计的各种难度查询

-- ============================================
-- 1. 简单单表查询 (Simple Single Table Queries)
-- ============================================

-- 1.1 过去三天新增多少新客户
-- 查询: 统计最近3天创建的客户数量
SELECT COUNT(*) as new_customers_count
FROM text2sql_companies 
WHERE createdAt >= strftime('%s', 'now', '-3 days');

-- 1.2 查询所有5星级客户
-- 查询: 找出所有星级为5的客户公司
SELECT companyId, name, star, country, homepage
FROM text2sql_companies 
WHERE star = 5;

-- 1.3 统计不同国家的客户数量
-- 查询: 按国家分组统计客户数量，按数量降序排列
SELECT country, countryName, COUNT(*) as customer_count
FROM text2sql_companies 
WHERE country IS NOT NULL
GROUP BY country, countryName
ORDER BY customer_count DESC;

-- 1.4 查询私海客户数量
-- 查询: 统计当前在私海的客户数量
SELECT COUNT(*) as private_customers
FROM text2sql_companies 
WHERE isPrivate = 1;

-- ============================================
-- 2. 中等单表查询 (Medium Single Table Queries)  
-- ============================================

-- 2.1 查询最近一周发送的WhatsApp消息统计
-- 查询: 统计最近7天的消息发送和接收情况
SELECT 
  COUNT(*) as total_messages,
  SUM(CASE WHEN fromMe = 1 THEN 1 ELSE 0 END) as sent_messages,
  SUM(CASE WHEN fromMe = 0 THEN 1 ELSE 0 END) as received_messages,
  COUNT(DISTINCT fromNumber) as unique_contacts
FROM text2sql_whatsapp_messages 
WHERE timestamp >= strftime('%s', 'now', '-7 days');

-- 2.2 查询金额最高的前10个商机
-- 查询: 找出金额最高的10个商机，包含详细信息
SELECT 
  opportunityId, 
  name, 
  amount, 
  currency, 
  stageName, 
  mainUserId,
  datetime(createTime, 'unixepoch') as create_date
FROM text2sql_opportunities 
ORDER BY amount DESC 
LIMIT 10;

-- 2.3 分析客户公司的地域分布
-- 查询: 统计各个时区的客户数量和平均星级
SELECT 
  timezone,
  COUNT(*) as customer_count,
  AVG(star) as avg_star_rating,
  COUNT(CASE WHEN isPrivate = 1 THEN 1 END) as private_count
FROM text2sql_companies 
WHERE timezone IS NOT NULL
GROUP BY timezone
HAVING customer_count >= 2
ORDER BY customer_count DESC;

-- ============================================
-- 3. 简单跨表查询 (Simple Multi-Table Queries)
-- ============================================

-- 3.1 查询某个销售员负责的所有客户
-- 查询: 找出用户ID为特定值的销售员负责的所有客户
SELECT 
  c.companyId,
  c.name as company_name,
  c.country,
  c.star,
  s.nickname as sales_person,
  r.relationType
FROM text2sql_companies c
JOIN text2sql_company_user_relations r ON c.companyId = r.companyId
JOIN text2sql_sales_users s ON r.userId = s.userId
WHERE s.userId = 'user123' -- 替换为实际用户ID
ORDER BY c.name;

-- 3.2 查询有联系人信息的客户公司
-- 查询: 列出所有有联系人的公司及其主联系人信息
SELECT 
  c.companyId,
  c.name as company_name,
  c.country,
  ct.name as contact_name,
  ct.email,
  ct.post,
  ct.isMain
FROM text2sql_companies c
JOIN text2sql_contacts ct ON c.companyId = ct.companyId
WHERE ct.isMain = 1  -- 只显示主联系人
ORDER BY c.name;

-- 3.3 查询每个销售员的客户数量
-- 查询: 统计每个销售员负责的客户数量
SELECT 
  s.userId,
  s.nickname,
  s.departmentName,
  COUNT(r.companyId) as customer_count,
  COUNT(CASE WHEN r.relationType = 'owner' THEN 1 END) as owned_customers
FROM text2sql_sales_users s
LEFT JOIN text2sql_company_user_relations r ON s.userId = r.userId
GROUP BY s.userId, s.nickname, s.departmentName
ORDER BY customer_count DESC;

-- ============================================
-- 4. 中等跨表查询 (Medium Multi-Table Queries)
-- ============================================

-- 4.1 过去三天有没有发过来的whatsapp消息，这个人手机号是+86139开头的，姓刘
-- 查询: 查找符合条件的WhatsApp消息及发送人信息
SELECT DISTINCT
  w.messageId,
  w.fromNumber,
  w.contactName,
  w.body,
  datetime(w.timestamp, 'unixepoch') as message_time,
  c.name as company_name,
  ct.name as contact_name,
  ct.email
FROM text2sql_whatsapp_messages w
LEFT JOIN text2sql_contacts ct ON w.fromNumber = ct.whatsapp
LEFT JOIN text2sql_companies c ON ct.companyId = c.companyId
WHERE w.fromMe = 0  -- 收到的消息
  AND w.timestamp >= strftime('%s', 'now', '-3 days')  -- 过去三天
  AND w.fromNumber LIKE '+86139%'  -- 手机号+86139开头
  AND (w.contactName LIKE '%刘%' OR ct.name LIKE '%刘%')  -- 姓刘
ORDER BY w.timestamp DESC;

-- 4.2 查询每个销售员的商机总金额和数量
-- 查询: 统计每个销售员的商机业绩
SELECT 
  s.userId,
  s.nickname,
  s.departmentName,
  COUNT(o.opportunityId) as opportunity_count,
  SUM(o.amount) as total_amount,
  AVG(o.amount) as avg_amount,
  MAX(o.amount) as max_amount
FROM text2sql_sales_users s
LEFT JOIN text2sql_opportunities o ON s.userId = o.mainUserId
GROUP BY s.userId, s.nickname, s.departmentName
HAVING opportunity_count > 0
ORDER BY total_amount DESC;

-- 4.3 查询最近一个月跟进最活跃的客户
-- 查询: 找出最近30天跟进次数最多的客户及其详情
SELECT 
  c.companyId,
  c.name as company_name,
  c.country,
  COUNT(f.followUpId) as follow_up_count,
  COUNT(DISTINCT f.userId) as involved_sales_count,
  MAX(f.createTime) as last_follow_up_time,
  s.nickname as last_follow_up_by
FROM text2sql_companies c
JOIN text2sql_follow_ups f ON c.companyId = f.companyId
LEFT JOIN text2sql_sales_users s ON f.userId = s.userId
WHERE f.createTime >= strftime('%s', 'now', '-30 days')
GROUP BY c.companyId, c.name, c.country
ORDER BY follow_up_count DESC
LIMIT 10;

-- ============================================
-- 5. 复杂跨表查询 (Complex Multi-Table Queries)
-- ============================================

-- 5.1 分析每个国家客户的综合业绩指标
-- 查询: 按国家统计客户数量、商机金额、跟进活跃度等综合指标
SELECT 
  c.country,
  c.countryName,
  COUNT(DISTINCT c.companyId) as company_count,
  COUNT(DISTINCT ct.customerId) as contact_count,
  COUNT(DISTINCT o.opportunityId) as opportunity_count,
  COALESCE(SUM(o.amount), 0) as total_opportunity_amount,
  COUNT(DISTINCT f.followUpId) as follow_up_count,
  AVG(c.star) as avg_star_rating,
  COUNT(CASE WHEN c.isPrivate = 1 THEN 1 END) as private_customers
FROM text2sql_companies c
LEFT JOIN text2sql_contacts ct ON c.companyId = ct.companyId
LEFT JOIN text2sql_opportunities o ON c.companyId = o.companyId
LEFT JOIN text2sql_follow_ups f ON c.companyId = f.companyId
WHERE c.country IS NOT NULL
GROUP BY c.country, c.countryName
HAVING company_count >= 3  -- 至少3个客户的国家
ORDER BY total_opportunity_amount DESC;

-- 5.2 客户生命周期分析：从首次接触到最新跟进
-- 查询: 分析客户从创建到最新活动的完整时间线
SELECT 
  c.companyId,
  c.name as company_name,
  datetime(c.createTime, 'unixepoch') as first_contact_date,
  datetime(MAX(f.createTime), 'unixepoch') as last_follow_up_date,
  (MAX(f.createTime) - c.createTime) / 86400.0 as relationship_days,
  COUNT(DISTINCT f.followUpId) as total_follow_ups,
  COUNT(DISTINCT o.opportunityId) as total_opportunities,
  COALESCE(SUM(o.amount), 0) as total_opportunity_value,
  COUNT(DISTINCT w.messageId) as whatsapp_message_count,
  s.nickname as main_sales_person
FROM text2sql_companies c
LEFT JOIN text2sql_follow_ups f ON c.companyId = f.companyId
LEFT JOIN text2sql_opportunities o ON c.companyId = o.companyId
LEFT JOIN text2sql_contacts ct ON c.companyId = ct.companyId
LEFT JOIN text2sql_whatsapp_messages w ON ct.whatsapp = w.fromNumber OR ct.whatsapp = w.toNumber
LEFT JOIN text2sql_company_user_relations r ON c.companyId = r.companyId AND r.relationType = 'owner'
LEFT JOIN text2sql_sales_users s ON r.userId = s.userId
WHERE c.createTime IS NOT NULL
GROUP BY c.companyId, c.name, c.createTime, s.nickname
HAVING total_follow_ups > 0  -- 有跟进记录的客户
ORDER BY relationship_days DESC;

-- 5.3 销售团队协作效率分析
-- 查询: 分析销售团队在客户管理中的协作情况
SELECT 
  s.departmentName,
  s.nickname as sales_person,
  COUNT(DISTINCT r.companyId) as managed_companies,
  COUNT(DISTINCT CASE WHEN r.relationType = 'owner' THEN r.companyId END) as owned_companies,
  COUNT(DISTINCT CASE WHEN r.relationType = 'collaborator' THEN r.companyId END) as collaborated_companies,
  COUNT(DISTINCT f.followUpId) as follow_ups_made,
  COUNT(DISTINCT o.opportunityId) as opportunities_managed,
  COALESCE(SUM(o.amount), 0) as total_opportunity_value,
  COUNT(DISTINCT f.companyId) as actively_followed_companies,
  ROUND(AVG(company_star.avg_star), 2) as avg_customer_star_rating
FROM text2sql_sales_users s
LEFT JOIN text2sql_company_user_relations r ON s.userId = r.userId
LEFT JOIN text2sql_follow_ups f ON s.userId = f.userId
LEFT JOIN text2sql_opportunities o ON s.userId = o.mainUserId
LEFT JOIN (
  SELECT 
    r2.userId,
    AVG(c2.star) as avg_star
  FROM text2sql_company_user_relations r2
  JOIN text2sql_companies c2 ON r2.companyId = c2.companyId
  WHERE r2.relationType = 'owner'
  GROUP BY r2.userId
) company_star ON s.userId = company_star.userId
GROUP BY s.departmentName, s.nickname, s.userId
ORDER BY s.departmentName, total_opportunity_value DESC;

-- ============================================
-- 6. 实时业务洞察查询 (Real-time Business Insights)
-- ============================================

-- 6.1 今日销售活动摘要
-- 查询: 显示今日的销售活动概况
SELECT 
  'Today Summary' as report_type,
  COUNT(DISTINCT CASE WHEN DATE(c.createdAt, 'unixepoch') = DATE('now') THEN c.companyId END) as new_customers_today,
  COUNT(DISTINCT CASE WHEN DATE(f.createTime, 'unixepoch') = DATE('now') THEN f.followUpId END) as follow_ups_today,
  COUNT(DISTINCT CASE WHEN DATE(o.createTime, 'unixepoch') = DATE('now') THEN o.opportunityId END) as new_opportunities_today,
  COALESCE(SUM(CASE WHEN DATE(o.createTime, 'unixepoch') = DATE('now') THEN o.amount END), 0) as opportunity_value_today,
  COUNT(DISTINCT CASE WHEN DATE(w.timestamp, 'unixepoch') = DATE('now') AND w.fromMe = 0 THEN w.messageId END) as whatsapp_received_today,
  COUNT(DISTINCT CASE WHEN DATE(w.timestamp, 'unixepoch') = DATE('now') AND w.fromMe = 1 THEN w.messageId END) as whatsapp_sent_today
FROM text2sql_companies c
CROSS JOIN text2sql_follow_ups f
CROSS JOIN text2sql_opportunities o  
CROSS JOIN text2sql_whatsapp_messages w;

-- 6.2 需要紧急跟进的客户预警
-- 查询: 找出超过7天未跟进的高价值客户
SELECT DISTINCT
  c.companyId,
  c.name as company_name,
  c.star,
  c.country,
  s.nickname as owner_sales,
  MAX(o.amount) as max_opportunity_value,
  datetime(MAX(f.createTime), 'unixepoch') as last_follow_up_date,
  (strftime('%s', 'now') - MAX(f.createTime)) / 86400.0 as days_since_last_follow_up,
  COUNT(DISTINCT o.opportunityId) as active_opportunities
FROM text2sql_companies c
JOIN text2sql_company_user_relations r ON c.companyId = r.companyId AND r.relationType = 'owner'
JOIN text2sql_sales_users s ON r.userId = s.userId
LEFT JOIN text2sql_follow_ups f ON c.companyId = f.companyId
LEFT JOIN text2sql_opportunities o ON c.companyId = o.companyId AND o.stageName NOT IN ('已关闭', '已失败')
WHERE c.star >= 4  -- 高星级客户
  AND c.isPrivate = 1  -- 私海客户
GROUP BY c.companyId, c.name, c.star, c.country, s.nickname
HAVING (strftime('%s', 'now') - MAX(f.createTime)) / 86400.0 > 7  -- 超过7天未跟进
   OR MAX(f.createTime) IS NULL  -- 或者从未跟进
ORDER BY max_opportunity_value DESC, days_since_last_follow_up DESC; 