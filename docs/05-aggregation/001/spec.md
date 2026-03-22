# 模块 05：划线聚合引擎（aggregation）

> 阶段：001
> 对应 PRD：§四核心算法（划线聚合与知识库更新）、§三.5设置-同步频率
> 对应 Tech：§六核心算法完整设计（6.1~6.5）、聚合API清单

---

## 1. 模块职责

- Embedding 向量化：批量将划线（含批注）向量化，存入 pgvector
- 相似度匹配：将每条划线与现有观点做向量检索，按阈值归属
- 候选观点管理：无匹配时创建候选观点，积累 ≥3 条后升级为正式观点
- 文章合成：调用大模型将观点素材池合成结构化认知文章（Markdown → TipTap JSON）
- 用户编辑保护：合成时跳过已被用户手动编辑的段落
- 图谱边更新：基于共享划线的 Jaccard 系数重建观点关系权重
- 任务调度：手动触发 + 用户配置定时（daily/weekly），BullMQ 队列，Redis 分布式锁
- 聚合状态查询：实时返回当前聚合进度

---

## 2. 聚合任务状态机

```
用户触发（手动 or 定时）
        │
        ▼
  获取 Redis 分布式锁
  key: aggregate:lock:{userId}，TTL 30 分钟
        │
        ├─ 获取失败 → 返回"聚合任务正在运行中"
        └─ 获取成功 → 状态 RUNNING
                │
                ├─ 阶段1：获取 PENDING 状态划线（每批最多 500 条）
                ├─ 阶段2：批量 Embedding 向量化（每批 50 条）
                ├─ 阶段3：相似度匹配 → 归属观点 / 创建候选
                ├─ 阶段4：候选观点升级检查
                ├─ 阶段5：受影响观点重新合成文章
                └─ 阶段6：更新知识图谱边权重
                        │
                        ▼
                  释放锁，状态 DONE
                  WebSocket 通知用户
```

---

## 3. Embedding 向量化

### 3.1 输入构造

| 划线类型 | 向量化内容 |
|---------|-----------|
| 仅原文 | `highlight.content` |
| 原文 + 批注 | `${content}\n\n用户思考：${note}` |
| 观点摘要 | `${viewpoint.title}\n\n${核心论点前500字}` |

### 3.2 批量处理

```typescript
const BATCH_SIZE = 50
const batches = chunk(pendingHighlights, BATCH_SIZE)

for (const batch of batches) {
  const inputs = batch.map(h =>
    h.note ? `${h.content}\n\n用户思考：${h.note}` : h.content
  )
  const embeddings = await embeddingClient.embed(inputs, userId)
  await db.batchUpdateEmbeddings(batch, embeddings)
}
```

---

## 4. 相似度匹配规则

```
阈值分级：
- > 0.85：强关联，直接归属该观点（confirmed = true）
- 0.70 ~ 0.85：弱关联，归属 + 标记待确认（confirmed = false）
- < 0.70：不归属，若所有观点均 < 0.70，则创建新候选观点

一条划线可同时归属多个观点（多对多关系）
```

pgvector 检索 SQL：

```sql
SELECT id, title,
  1 - (summary_embedding <=> $1::vector) AS similarity
FROM viewpoints
WHERE user_id = $2
  AND summary_embedding IS NOT NULL
ORDER BY summary_embedding <=> $1::vector
LIMIT 10
```

---

## 5. 候选观点规则

- 新划线无匹配时，创建候选观点（`is_candidate = true`，title 由 AI 生成）
- 候选观点积累 ≥ 3 条划线后，正式升级（`is_candidate = false`），进入合成队列
- 升级前先检查：与现有正式观点相似度 > 0.80，则合并而非新建

---

## 6. 文章合成

### 6.1 触发条件

- 观点素材池（划线数量）发生变化
- 受影响的正式观点进入合成队列

### 6.2 Prompt 结构（完整版）

```
系统提示：
你是用户的个人知识助手，专门帮助用户将阅读中的划线整合为个人认知文章。
原则：忠实呈现（不编造）、逻辑连贯、结构清晰、第一人称、引用必须标注来源。

用户消息：
请将以下关于「{观点名称}」的划线和批注整合为一篇认知文章。

划线来源：
【书名1】
  - 原文："..."
    用户批注：...
  - 原文："..."

【书名2】
  - 原文："..."

输出格式（Markdown）：
# {观点标题}
## 核心论点
## 论据与展开
> 引用：《书名》
> "原文..."
> 我的批注：...
## 我的理解
## 关联思考
```

### 6.3 Markdown → TipTap JSON

合成后的 Markdown 转换为 TipTap 文档 JSON，包含：
- 普通段落（`paragraph`）
- 引用块（自定义 `quoteBlock` 节点，携带 `highlightId` + 跳转 URL）
- 标题（`heading`）

每个节点携带属性：
```typescript
{
  id: string,          // 段落唯一 ID
  isUserEdited: false, // 新合成内容初始为 false
  sourceType: 'ai',
}
```

### 6.4 用户编辑保护

```typescript
async function mergeArticle(existingDoc, newAiContent) {
  // 提取用户手动编辑的段落（isUserEdited = true）
  const userEditedNodes = new Map()
  for (const node of existingDoc?.content ?? []) {
    if (node.attrs.isUserEdited) {
      userEditedNodes.set(node.attrs.id, node)
    }
  }

  // 新内容中相同 ID 的节点，若已被用户编辑，保留用户版本
  return newAiContent.map(node =>
    userEditedNodes.get(node.attrs.id) ?? node
  )
}
```

---

## 7. 图谱边权重（Jaccard）

```sql
-- 重建某观点的图谱边：Jaccard = 交集 / 并集
WITH shared AS (
  SELECT hv2.viewpoint_id AS target_id,
    COUNT(DISTINCT hv1.highlight_id) AS shared_count
  FROM highlight_viewpoints hv1
  JOIN highlight_viewpoints hv2
    ON hv1.highlight_id = hv2.highlight_id
    AND hv2.viewpoint_id != $1
  WHERE hv1.viewpoint_id = $1
  GROUP BY hv2.viewpoint_id
)
INSERT INTO viewpoint_relations (source_id, target_id, weight, updated_at)
SELECT $1, s.target_id,
  s.shared_count::float / (t_src.total + t_tgt.total - s.shared_count),
  NOW()
FROM shared s
JOIN ...
ON CONFLICT (source_id, target_id)
DO UPDATE SET weight = EXCLUDED.weight, updated_at = NOW();
```

---

## 8. BullMQ 任务队列设计

```
队列：aggregation-queue
  Job: run-aggregation
    payload: { userId }
    options: { jobId: `agg-${userId}`, removeOnComplete: 100 }

队列：embedding-queue（子队列，阶段2使用）
  Job: embed-batch
    payload: { userId, highlightIds: string[] }

调度：
  手动触发：立即入队
  定时（daily）：node-cron '0 2 * * *' → 为所有 schedule='daily' 用户入队
  定时（weekly）：node-cron '0 2 * * 0' → 为 schedule='weekly' 用户入队
```

---

## 9. API 清单

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/aggregate` | 手动触发聚合 |
| GET | `/api/aggregate/status` | 当前聚合任务状态 |
| GET | `/api/aggregate/history` | 历史聚合记录 |

**POST `/api/aggregate` 响应：**
```json
{ "jobId": "agg-xxx", "status": "QUEUED" }
```

**GET `/api/aggregate/status` 响应：**
```json
{
  "status": "RUNNING",  // IDLE | RUNNING | DONE | FAILED
  "progress": {
    "stage": "vectorizing",   // 当前阶段
    "processed": 42,
    "total": 100
  }
}
```

---

## 10. 验收标准

- [ ] 手动触发聚合，PENDING 划线被向量化，状态变为 PROCESSED
- [ ] 划线成功归属到相关观点（similarity > 0.85 为强关联）
- [ ] 积累 3 条划线的候选观点自动升级并生成文章
- [ ] 同一用户同时只允许一个聚合任务（第二次触发返回提示）
- [ ] 文章合成后，用户手动编辑的段落不被覆盖
- [ ] 图谱边权重正确更新（Jaccard 计算验证）
- [ ] 定时聚合（daily/weekly）按计划触发
