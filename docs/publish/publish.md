# 模块 08：发布模块（publish）

> 阶段：001
> 对应 PRD：§三.4 发布（Publish）
> 对应 Tech：§八发布模块（8.1~8.4）

---

## 1. 模块职责

- 发布目标管理：配置 KMS / Webhook 目标（URL + 认证头）
- 发布任务管理：选择来源文章、目标、格式、触发方式
- 触发方式：手动触发 / 定时（cron）/ 内容变更后延迟 N 分钟
- 格式支持：Markdown / PDF / HTML
- 发布历史：每次发布的时间、状态（SUCCESS/FAILED）、版本
- 邮件发送（文章快捷操作，实现放在知识库模块，本模块提供底层服务）
- PDF 导出（后端 Puppeteer 生成）

> 本模块属于二期功能，PRD 明确标注。001 阶段完成完整实现。

---

## 2. 发布页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  [+ 新建目标]  [+ 新建任务]                                  │
├──────────────────┬──────────────────────────────────────────┤
│  发布任务列表    │  任务配置面板                              │
│                  │                                           │
│  ○ 周报发布      │  名称：周报发布                           │
│    每周一 9:00   │  来源：[第一性原理思维] [长期主义]         │
│    ✅ 上次成功   │  目标：公司 KMS ▼                         │
│                  │  格式：Markdown ▼                        │
│  ○ 每日笔记      │  触发：定时 cron：0 9 * * 1               │
│    手动          │  状态：已启用                             │
│                  │                                           │
│                  │  发布历史：                               │
│                  │  2026-03-21 09:00  ✅ 成功               │
│                  │  2026-03-14 09:00  ✅ 成功               │
│                  │  2026-03-07 09:02  ❌ 失败  [查看错误]   │
└──────────────────┴──────────────────────────────────────────┘
```

---

## 3. 数据模型

```sql
-- 发布目标
CREATE TABLE publish_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(200),          -- 如"公司 KMS"
  type          VARCHAR(50),           -- 'webhook' | 'kms'
  endpoint_url  TEXT,
  auth_header   TEXT,                  -- Authorization header（AES 加密存储）
  extra_config  JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 发布任务
CREATE TABLE publish_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200),
  viewpoint_ids   UUID[],              -- 来源观点（一篇或多篇）
  target_id       UUID REFERENCES publish_targets(id),
  format          VARCHAR(20),         -- 'markdown' | 'pdf' | 'html'
  trigger_type    VARCHAR(20),         -- 'manual' | 'cron' | 'on_change'
  cron_expr       VARCHAR(100),        -- 如 '0 9 * * 1'（每周一 9:00）
  on_change_delay INT,                 -- 内容变更后延迟 N 分钟
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 发布记录
CREATE TABLE publish_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES publish_tasks(id) ON DELETE CASCADE,
  triggered_by    VARCHAR(20),         -- 'manual' | 'cron' | 'on_change'
  status          VARCHAR(20),         -- 'SUCCESS' | 'FAILED' | 'RUNNING'
  error_msg       TEXT,
  article_version VARCHAR(64),         -- 文章内容 hash（用于版本对比）
  executed_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. 触发机制

### 4.1 手动触发

```typescript
// POST /api/publish/tasks/:id/trigger
await publishQueue.add('publish', { taskId: task.id, triggeredBy: 'manual' })
```

### 4.2 定时触发（cron）

```typescript
// 系统启动时加载所有 cron 任务
async function initPublishScheduler() {
  const tasks = await db.query(`
    SELECT * FROM publish_tasks
    WHERE trigger_type = 'cron' AND enabled = true
  `)

  for (const task of tasks) {
    nodeCron.schedule(task.cronExpr, async () => {
      await publishQueue.add('publish', { taskId: task.id, triggeredBy: 'cron' })
    })
  }
}
```

### 4.3 内容变更触发

在 `aggregation` 模块的 `synthesizeArticle` 完成后调用：

```typescript
async function onArticleSynthesized(viewpointId: string) {
  const tasks = await db.query(`
    SELECT * FROM publish_tasks
    WHERE $1 = ANY(viewpoint_ids)
      AND trigger_type = 'on_change'
      AND enabled = true
  `, [viewpointId])

  for (const task of tasks) {
    await publishQueue.add('publish', { taskId: task.id }, {
      delay: task.onChangeDelay * 60 * 1000,  // 延迟 N 分钟
    })
  }
}
```

---

## 5. Webhook 发布实现

```typescript
async function executeWebhookPublish(task: PublishTask) {
  const articles = await getViewpointsContent(task.viewpointIds)

  let content: string
  switch (task.format) {
    case 'markdown':
      content = articles.map(a => tipTapToMarkdown(a.articleContent)).join('\n\n---\n\n')
      break
    case 'html':
      content = articles.map(a => tipTapToHtml(a.articleContent)).join('')
      break
    case 'pdf':
      content = await generatePdfBase64(articles)
      break
  }

  const target = await db.findPublishTarget(task.targetId)
  const response = await fetch(target.endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': decrypt(target.authHeader),
    },
    body: JSON.stringify({
      title: articles.map(a => a.title).join(' + '),
      content,
      format: task.format,
      publishedAt: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${await response.text()}`)
  }
}
```

---

## 6. PDF 生成

使用 Puppeteer（或 `@react-pdf/renderer`）将 TipTap 文章内容渲染为 PDF：

```typescript
// GET /api/viewpoints/:id/export?format=pdf
async function generatePdf(viewpointId: string): Promise<Buffer> {
  const article = await getViewpointWithContent(viewpointId)
  const html = `<html><body>${tipTapToHtml(article.articleContent)}</body></html>`

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(html)
  const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm' } })
  await browser.close()
  return pdf
}
```

---

## 7. API 清单

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/publish/targets` | 发布目标列表 |
| POST | `/api/publish/targets` | 新建发布目标 |
| PUT | `/api/publish/targets/:id` | 修改发布目标 |
| DELETE | `/api/publish/targets/:id` | 删除发布目标 |
| GET | `/api/publish/tasks` | 发布任务列表 |
| POST | `/api/publish/tasks` | 新建发布任务 |
| PUT | `/api/publish/tasks/:id` | 修改任务配置 |
| DELETE | `/api/publish/tasks/:id` | 删除任务 |
| POST | `/api/publish/tasks/:id/trigger` | 手动触发一次 |
| GET | `/api/publish/tasks/:id/records` | 发布历史 |

---

## 8. 验收标准

- [ ] 创建 Webhook 发布目标，认证头加密存储
- [ ] 新建发布任务，配置来源文章 + 目标 + 触发方式
- [ ] 手动触发发布，Webhook 收到正确格式的请求
- [ ] 定时 cron 任务按时触发（可用 1 分钟间隔验证）
- [ ] 内容变更后，`on_change` 类型任务在延迟后自动触发
- [ ] PDF 导出正常生成，排版清晰
- [ ] 发布失败时，历史记录中显示错误信息
- [ ] 禁用任务后，定时任务不再触发
