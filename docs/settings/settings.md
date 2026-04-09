# 模块：设置（settings）

---

## 1. 模块职责

- AI 模型配置：为各场景独立配置 Base URL、API Key、Model Name
- Scout 信源管理：添加/编辑/删除信源（详见 scout.md）
- MCP API Key 管理：生成、查看、撤销 MCP 访问密钥
- 存储配置：书籍文件存储模式
- 账户：数据导出、清除数据

---

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  设置                                                        │
├──────────────────────────────────────────────────────────────┤
│  [AI 模型]  [MCP]  [Scout]  [存储]  [账户]                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. AI 模型配置

每个使用场景独立配置，互不影响。

| 场景 | 说明 |
|------|------|
| `explain` | 读中即时解释，要求响应快，适合小模型（gpt-4o-mini 等） |
| `summary` | 读前章节摘要、读后论点卡片生成，可用较强模型 |
| `embed` | 文本向量化，需支持 `/embeddings` 接口 |

每个场景配置三个字段：

```
Base URL:  [https://api.openai.com/v1         ]
API Key:   [sk-****************************   ]  [显示/隐藏]
Model:     [gpt-4o-mini                       ]  [测试连通]
```

连通性测试：发送一次最小请求（explain/summary 发 /chat/completions，embed 发 /embeddings），验证 200 响应即可。

---

## 4. MCP 管理

### API Key 列表

```
┌──────────────────────────────────────────────────────────────┐
│  MCP API Keys                              [生成新 Key]       │
├──────────────────────────────────────────────────────────────┤
│  Claude Code       read_write   最近使用：今天    [撤销]       │
│  Cursor Plugin     read         最近使用：3天前   [撤销]       │
└──────────────────────────────────────────────────────────────┘
```

### 生成 Key

```
[标签]: Claude Code
[权限]: ○ 只读   ● 读写
[生成]
```

生成后显示完整 Key（仅显示一次），提示用户复制。

### MCP 服务状态

显示当前 MCP server 监听端口（默认 3721），以及是否正常运行。提供端口修改入口（重启后生效）。

---

## 5. Scout 信源配置

入口跳转到信源管理页（详见 scout.md）。在设置页展示摘要：

```
已配置 3 个信源，上次抓取：5 分钟前   [管理信源 →]
```

---

## 6. 存储配置

```
书籍文件存储模式
  ○ 引用模式（默认）：记录原始文件路径，不复制文件
  ● 拷贝模式：导入时复制到应用目录，文件路径变动不影响阅读

应用数据目录：~/Library/Application Support/Lumina/
              [在 Finder 中打开]
```

---

## 7. 账户

```
数据导出
  导出所有高亮和批注为 JSON / Markdown  [导出]

清除数据
  清除所有阅读数据（不可恢复）          [清除]
```

---

## 8. 数据存储

设置全部存在 SQLite `settings` 表中，key-value 结构：

```sql
-- AI 模型配置
INSERT INTO settings VALUES ('ai_config', '{
  "explain": {"base_url": "...", "api_key": "enc:...", "model": "gpt-4o-mini"},
  "summary": {"base_url": "...", "api_key": "enc:...", "model": "claude-sonnet-4-6"},
  "embed":   {"base_url": "...", "api_key": "enc:...", "model": "text-embedding-3-small"}
}');

-- 存储模式
INSERT INTO settings VALUES ('storage', '{"mode": "reference"}');

-- MCP 端口
INSERT INTO settings VALUES ('mcp_port', '3721');
```

API Key 字段值以 `enc:` 前缀标识加密存储（AES-256-GCM，密钥派生自设备标识）。

---

## 9. Tauri 命令清单

| 命令 | 说明 |
|------|------|
| `get_settings(key?)` | 获取设置（null = 全部） |
| `update_settings(key, value)` | 更新设置 |
| `test_ai_connection(usage)` | 测试 AI 模型连通性 |
| `get_mcp_keys()` | 获取 MCP API Key 列表（不返回原始 key） |
| `create_mcp_key(label, permission)` | 生成新 MCP Key（返回明文，仅一次） |
| `revoke_mcp_key(id)` | 撤销 MCP Key |
| `export_data(format)` | 导出数据（json / markdown） |
