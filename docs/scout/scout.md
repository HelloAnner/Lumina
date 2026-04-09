# 模块：Scout（信息采集）

---

## 1. 模块职责

自动化监听互联网信息源（RSS、网页、Newsletter），将文章直接存入文章库，无需人工审批。Scout 是 Lumina 阅读队列的自动填充器。

**核心原则**：

- **零审批**：文章自动进入文章库，用户在文章库中决定读不读，而非决定存不存
- **文章即阅读体**：抓取的文章与手动导入的文章完全等价，可阅读、高亮、批注
- **安静运行**：后台静默执行，仅在新文章到达时通过系统通知提示（可关闭）
- **来源可溯**：每篇文章保留原始 URL、来源信道、发布时间

---

## 2. 功能架构

### 页面布局

Scout 页面（侧边栏「文章」）分两个视图：

**文章库视图**（默认）：
```
┌─────────────────────────────────────────────────────────────┐
│  文章                    [搜索]  [按信源▾]  [未读▾]           │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐    │
│  │  标题                               信源 · 3天前 · 未读 │  │
│  │  摘要截断...                                          │  │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  标题                              信源 · 1周前 · 已读  │  │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**信源管理视图**（设置入口进入）：
```
┌─────────────────────────────────────────────────────────────┐
│  信源                                          [添加信源]     │
├──────────────────────────────────────────────────────────────┤
│  Hacker News        RSS    每小时    最后抓取：5分钟前  [●启用] │
│  Paul Graham's Blog 网页   每天      最后抓取：昨天     [●启用] │
│  My Newsletter      邮件   实时      最后接收：3天前    [●启用] │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 抓取管道（Rust）

```
tokio-cron-scheduler 触发（各信源独立频率）
         ↓
scout/fetcher.rs
  RSS:     feed-rs 解析 Atom/RSS 条目
  网页:    reqwest 抓取 HTML → scraper 提取正文
  邮件:    webhook POST 接收
         ↓
scout/extractor.rs
  Readability 算法：提取标题、作者、发布时间、正文
  图片 URL 本地化（下载到 articles/ 目录）
         ↓
URL 去重（articles 表 UNIQUE url，重复则跳过）
         ↓
写入 articles 表（source_id = channel.id）
         ↓
tokio::spawn 异步：
  1. AI 生成摘要（POST /chat/completions）
  2. 向量化文章标题+摘要（写入 highlight_embeddings）
         ↓
app.emit("scout_new_articles", {channelId, count})
前端更新文章列表
```

---

## 4. 协议支持

### RSS / Atom

```rust
// fetcher.rs
let content = reqwest::get(&channel.endpoint).await?.text().await?;
let feed = feed_rs::parser::parse(content.as_bytes())?;
for entry in feed.entries {
    let article = Article {
        url: entry.links[0].href.clone(),
        title: entry.title.map(|t| t.content),
        published_at: entry.published.map(|dt| dt.timestamp()),
        // ...
    };
    pipeline::process(article, &channel).await?;
}
```

### 网页监控

指定 URL，定时抓取，检测内容变化（通过 hash 对比），提取新增文章条目。

### Newsletter（Webhook）

Lumina 暴露一个本地 webhook 端点（通过 MCP server 扩展）：

```
POST http://localhost:3721/scout/newsletter
Authorization: Bearer <key>
Content-Type: application/json
{"title": "...", "content": "...", "from": "...", "date": "..."}
```

用户在邮件客户端配置转发规则（或使用 Zapier/Make 中转）将 Newsletter 推送到此端点。

---

## 5. 信源配置

```typescript
interface ScoutChannel {
  id: string
  name: string
  protocol: 'rss' | 'webpage' | 'newsletter'
  endpoint: string
  fetchInterval: number  // 秒，默认 3600
  isActive: boolean
  lastFetchedAt?: number
}
```

添加信源时，触发一次立即抓取以验证可达性，并预填充初始文章。

---

## 6. Tauri 命令清单

| 命令 | 说明 |
|------|------|
| `get_scout_channels()` | 获取所有信源 |
| `create_scout_channel(data)` | 添加信源 |
| `update_scout_channel(id, data)` | 修改信源（含启用/禁用） |
| `delete_scout_channel(id)` | 删除信源 |
| `trigger_scout_fetch(channelId?)` | 立即抓取（null = 全部） |
| `get_scout_status()` | 各信源最近抓取状态 |
