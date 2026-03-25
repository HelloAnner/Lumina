# 模块 09：设置（settings）

> 阶段：001
> 对应 PRD：§三.5 设置（Settings）
> 对应 Tech：§九设置模块完整覆盖（9.1~9.4）

---

## 1. 模块职责

- 多模型配置：为"聚合分析 / 文章生成 / 即时解释 / Embedding"分别配置 Base URL、API Key、Model Name
- 模型连通性测试：一键验证配置是否可用
- 聚合频率配置：手动 / 每天 / 每周
- 手动触发聚合：设置页可直接触发一次全量聚合
- MinIO 存储配置：支持使用平台默认存储或自定义 MinIO
- 账户信息：修改基本信息、修改密码、全量数据导出、账户注销

---

## 2. 设置页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  设置                                                        │
├──────────────────────────────────────────────────────────────┤
│  [模型配置]  [存储配置]  [同步设置]  [账户]                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ── 模型配置 ───────────────────────────────────────────     │
│                                                              │
│  即时解释模型                                                 │
│  Base URL: [____________________________]                    │
│  API Key:  [****************************]                    │
│  Model:    [gpt-4o-mini               ]  [测试连通]          │
│                                                              │
│  文章生成模型                                                 │
│  Base URL: [____________________________]                    │
│  API Key:  [****************************]                    │
│  Model:    [claude-3-5-sonnet-20241022]  [测试连通]          │
│                                                              │
│  Embedding 模型                                              │
│  Base URL: [____________________________]                    │
│  API Key:  [****************************]                    │
│  Model:    [text-embedding-3-small    ]  [测试连通]          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 多模型配置

### 3.1 数据模型

```sql
CREATE TABLE user_model_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  usage       VARCHAR(50) NOT NULL,
  -- 'aggregation'（聚合分析）
  -- 'synthesis' （文章生成）
  -- 'explain'   （即时解释）
  -- 'embedding' （向量化）
  base_url    TEXT NOT NULL,
  api_key     TEXT NOT NULL,  -- AES-256-GCM 加密存储
  model_name  VARCHAR(200) NOT NULL,
  UNIQUE (user_id, usage)
);
```

### 3.2 API Key 加密

- 存储：`AES-256-GCM` 加密，密钥来自环境变量 `ENCRYPTION_KEY`
- 读取时：前端只看到掩码（`****`），不返回明文
- 使用时：后端解密后直接传给 LLM 客户端，不经前端

### 3.3 连通性测试

```typescript
// POST /api/settings/models/test
async function testModelConnection(config: { baseUrl, apiKey, modelName, usage }) {
  if (config.usage === 'embedding') {
    // embedding 测试：embed 一段短文本
    const result = await embeddingClient.embedOne('test', {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      modelName: config.modelName,
    })
    return { success: !!result, dimensions: result?.length }
  }

  // LLM 测试：发送简短消息
  try {
    const result = await generateText({
      model: createOpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey })(config.modelName),
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 5,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
```

---

## 4. 聚合频率配置

| 选项 | 说明 | Cron 表达式 |
|------|------|------------|
| 手动 | 不自动触发，仅手动触发 | 无 |
| 每天 | 每天凌晨 2 点触发 | `0 2 * * *` |
| 每周 | 每周日凌晨 2 点触发 | `0 2 * * 0` |

```sql
ALTER TABLE users ADD COLUMN aggregate_schedule VARCHAR(20) DEFAULT 'manual';
ALTER TABLE users ADD COLUMN aggregate_cron VARCHAR(100);
```

设置变更后，`initPublishScheduler` 类似机制重新注册定时任务。

---

## 5. MinIO 存储配置

```typescript
interface StorageConfig {
  useCustom: boolean   // false = 使用平台默认 MinIO
  endpoint?: string    // 自定义 MinIO 地址（如 http://192.168.1.100:9000）
  accessKey?: string
  secretKey?: string   // AES 加密存储
  bucket?: string
  region?: string      // 默认 'us-east-1'
}
```

切换存储配置时，**不迁移**已有文件（用户需自行处理），仅影响新上传文件。

---

## 6. 账户管理

| 功能 | 接口 | 说明 |
|------|------|------|
| 获取个人信息 | GET `/api/account/profile` | 邮箱、注册时间 |
| 修改密码 | PUT `/api/account/password` | 需验证旧密码 |
| 全量数据导出 | GET `/api/account/export` | ZIP 包含所有书籍元数据、划线、观点文章 |
| 账户注销 | DELETE `/api/account` | 软删除 + 清理 MinIO 文件 |

---

## 7. API 清单

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/settings/models` | 获取所有模型配置（掩码显示 API Key） |
| PUT | `/api/settings/models/:usage` | 保存某用途的模型配置 |
| DELETE | `/api/settings/models/:usage` | 删除某用途的模型配置 |
| POST | `/api/settings/models/test` | 连通性测试 |
| GET | `/api/settings/storage` | 获取存储配置 |
| PUT | `/api/settings/storage` | 保存存储配置 |
| GET | `/api/settings/schedule` | 获取聚合频率配置 |
| PUT | `/api/settings/schedule` | 保存聚合频率（触发重新注册定时任务） |
| GET | `/api/account/profile` | 获取个人信息 |
| PUT | `/api/account/profile` | 修改个人信息 |
| PUT | `/api/account/password` | 修改密码 |
| GET | `/api/account/export` | 全量数据导出（ZIP） |
| DELETE | `/api/account` | 注销账户 |

---

## 8. 验收标准

- [ ] 配置即时解释模型后，阅读器 AI 解释功能正常使用该模型
- [ ] 配置文章生成模型后，聚合引擎使用该模型合成文章
- [ ] 配置 Embedding 模型后，向量化使用该模型
- [ ] API Key 存储后，前端只显示掩码（`****`），无法从响应中还原明文
- [ ] 连通性测试：配置正确时返回成功，错误 Key 时返回失败
- [ ] 聚合频率改为"每天"后，定时任务注册成功
- [ ] 手动触发聚合按钮正常工作
- [ ] 数据导出 ZIP 包含正确内容
- [ ] 账户注销后，登录返回 401，MinIO 文件被清理
