# 模块：MCP Server

---

## 1. 模块职责

将 Lumina 的阅读数据对外开放，让任何支持 MCP 协议的 AI 工具（Claude Code、Cursor、本地 LLM 客户端等）都能访问用户的阅读记忆。

MCP Server 是 Lumina 最重要的对外出口，也是与所有竞品最本质的差异点。

---

## 2. 架构

```
Tauri 应用启动
      ↓
tokio::spawn MCP Server（axum，127.0.0.1:3721）
      ↓
共享 AppState（SQLite db pool）
      ↓
接受来自 MCP 客户端的 HTTP 请求
      ↓
查询/写入本地数据库，返回结果
```

Server 与 Tauri 应用同生命周期。应用关闭时 Server 停止，不提供独立守护进程模式。

---

## 3. 接口设计

所有接口使用 `Authorization: Bearer <api_key>` 认证。

### 3.1 查询接口（只读权限）

#### 高亮查询

```
GET /mcp/highlights/search?q={query}&limit={n}&source_type={book|article}
```
语义搜索全部高亮（sqlite-vec 向量检索）。返回最相关的 N 条。

```
GET /mcp/highlights?source_type={book|article}&source_id={id}
```
按来源获取全部高亮（含批注）。

```
GET /mcp/highlights/recent?days={n}
```
最近 N 天创建的高亮。

```
GET /mcp/highlights/topic?q={topic}&limit={n}
```
按主题语义查询，跨书籍和文章。

#### 书籍与摘要

```
GET /mcp/books
GET /mcp/books/{id}
GET /mcp/books/{id}/summary
```
`summary` 端点：若已有缓存则直接返回，否则实时调用 AI 生成（基于该书所有高亮）。

#### 文章

```
GET /mcp/articles?tag={tag}&source_id={channel_id}&is_favorite={0|1}
GET /mcp/articles/{id}
GET /mcp/articles/{id}/summary
```

#### 笔记卡片

```
GET /mcp/notes?tag={tag}&generated_by={ai|user}
GET /mcp/notes/{id}
```

#### 阅读历史与统计

```
GET /mcp/reading/history?limit={n}
GET /mcp/stats
```

`stats` 返回：
```json
{
  "total_highlights": 342,
  "total_books": 18,
  "total_articles": 127,
  "recent_activity": "2026-04-09"
}
```

### 3.2 写入接口（读写权限）

```
POST /mcp/notes
Body: {"title": "...", "content": "...", "tags": [...]}
```
外部 AI 工具向 Lumina 写入笔记卡片。

```
POST /mcp/highlights
Body: {
  "source_type": "article",
  "source_id": "...",
  "text": "...",
  "note": "..."
}
```

---

## 4. 响应格式

统一 JSON 响应：

```json
// 成功
{"data": {...}, "ok": true}

// 错误
{"error": "Unauthorized", "ok": false}
```

高亮对象结构：

```json
{
  "id": "hlg_xxx",
  "sourceType": "book",
  "sourceId": "bk_xxx",
  "sourceName": "原则",
  "content": "高亮原文...",
  "note": "用户批注...",
  "color": "yellow",
  "createdAt": 1712600000
}
```

---

## 5. 认证实现

```rust
// auth.rs
async fn auth_middleware(
    State(pool): State<SqlitePool>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let key_hash = sha256_hex(token);

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM mcp_api_keys WHERE key_hash = ? AND 1=1)"
    )
    .bind(&key_hash)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !exists {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 更新最近使用时间（fire-and-forget）
    let pool_clone = pool.clone();
    tokio::spawn(async move {
        let _ = sqlx::query(
            "UPDATE mcp_api_keys SET last_used_at = unixepoch() WHERE key_hash = ?"
        )
        .bind(&key_hash)
        .execute(&pool_clone)
        .await;
    });

    Ok(next.run(req).await)
}
```

---

## 6. 客户端配置示例

用户在 Claude Code 的 MCP 配置中添加 Lumina：

```json
// ~/.claude/mcp_servers.json
{
  "lumina": {
    "command": "npx",
    "args": ["@lumina/mcp-client", "--url", "http://localhost:3721"],
    "env": {
      "LUMINA_API_KEY": "lmn_xxxxxxxxxxxxxxxxxx"
    }
  }
}
```

或直接通过 HTTP（适用于支持 HTTP MCP 的客户端）：

```
Base URL: http://localhost:3721/mcp
API Key:  lmn_xxxxxxxxxxxxxxxxxx
```

---

## 7. 扩展能力（规划）

- **语义问答**：`POST /mcp/ask` — 基于全量高亮回答自然语言问题
- **timeline**：`GET /mcp/timeline` — 按时间线返回阅读和高亮事件
- **export**：`GET /mcp/export?format=markdown` — 批量导出为 Markdown
