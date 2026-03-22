# 模块 01：基础设施 & 认证（infra-auth）

> 阶段：001
> 对应 PRD：§五平台策略、§三.5设置-账户、§十二安全设计
> 对应 Tech：§零技术栈、§一系统整体架构、§十完整DB Schema、§十一认证API、§十二安全设计

---

## 1. 模块职责

本模块负责整个项目的地基：

- 全栈 TypeScript 项目脚手架搭建（Next.js 14 前端 + Hono 后端）
- PostgreSQL + pgvector 数据库完整 Schema 初始化
- Redis、MinIO、BullMQ 基础设施连接封装
- 用户注册 / 登录 / Token 刷新 / 登出
- JWT 鉴权中间件（后续所有受保护路由依赖）
- 用户数据隔离机制（所有查询强制 `user_id` 过滤）
- API Key 加解密工具（AES-256-GCM）
- 账户管理：修改密码、全量数据导出（ZIP）、账户注销

---

## 2. 项目目录结构

```
lumina/
├── frontend/                  # Next.js 14 (App Router)
│   ├── app/
│   │   ├── (auth)/            # 登录/注册页（无需鉴权）
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── layout.tsx         # 全局布局（左侧 Sidebar）
│   │   └── ...                # 后续模块页面
│   ├── components/
│   ├── lib/
│   │   └── api-client.ts      # 统一请求封装（自动带 token）
│   ├── store/                 # 全局状态（auth、user）
│   └── ...
│
└── backend/                   # Hono API Server (Node.js)
    ├── src/
    │   ├── index.ts            # Hono 入口，挂载路由 + 中间件
    │   ├── routes/
    │   │   ├── auth.ts         # 认证路由
    │   │   └── account.ts      # 账户管理路由
    │   ├── middleware/
    │   │   ├── auth.ts         # JWT 鉴权中间件
    │   │   ├── user-scope.ts   # 注入 userId，强制数据隔离
    │   │   └── rate-limit.ts   # Redis 速率限制
    │   ├── lib/
    │   │   ├── crypto.ts       # AES-256-GCM 加解密
    │   │   ├── redis.ts        # Redis 客户端 + 分布式锁
    │   │   ├── minio.ts        # MinIO 客户端封装
    │   │   └── bullmq.ts       # BullMQ 队列初始化
    │   └── db/
    │       ├── client.ts       # pg 驱动客户端
    │       ├── schema.sql      # 完整建表语句
    │       └── migrations/     # 数据迁移脚本
    ├── package.json
    └── tsconfig.json
```

---

## 3. 数据库 Schema（完整）

以下为全项目所有表的建表语句，在本模块一次性初始化。

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) UNIQUE NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  aggregate_schedule  VARCHAR(20) DEFAULT 'manual', -- 'manual'|'daily'|'weekly'
  aggregate_cron      VARCHAR(100),
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 书籍表
CREATE TABLE books (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  author          VARCHAR(255),
  format          VARCHAR(10) NOT NULL CHECK (format IN ('PDF', 'EPUB')),
  minio_path      VARCHAR(1000) NOT NULL,
  cover_path      VARCHAR(1000),
  total_pages     INT,
  read_progress   FLOAT DEFAULT 0 CHECK (read_progress BETWEEN 0 AND 1),
  last_read_at    TIMESTAMPTZ,
  tags            TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 划线表（核心表）
CREATE TABLE highlights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id             UUID REFERENCES books(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  format              VARCHAR(10) NOT NULL,
  page_index          INT,
  para_offset_start   INT,
  para_offset_end     INT,
  rects_json          TEXT,
  cfi_range           TEXT,
  chapter_href        TEXT,
  content             TEXT NOT NULL,
  note                TEXT,
  color               VARCHAR(20) DEFAULT 'yellow',
  embedding           vector(1536),
  status              VARCHAR(20) DEFAULT 'PENDING', -- PENDING|VECTORIZED|PROCESSED
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 观点表（知识库节点）
CREATE TABLE viewpoints (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id           UUID REFERENCES viewpoints(id),
  title               VARCHAR(500) NOT NULL,
  is_folder           BOOLEAN DEFAULT false,
  is_candidate        BOOLEAN DEFAULT false,
  sort_order          INT DEFAULT 0,
  highlight_count     INT DEFAULT 0,
  summary_embedding   vector(1536),
  article_content     TEXT, -- TipTap JSON
  last_synthesized_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 划线-观点多对多
CREATE TABLE highlight_viewpoints (
  highlight_id      UUID REFERENCES highlights(id) ON DELETE CASCADE,
  viewpoint_id      UUID REFERENCES viewpoints(id) ON DELETE CASCADE,
  similarity_score  FLOAT,
  confirmed         BOOLEAN DEFAULT false,
  PRIMARY KEY (highlight_id, viewpoint_id)
);

-- 观点关系（图谱边）
CREATE TABLE viewpoint_relations (
  source_id   UUID REFERENCES viewpoints(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES viewpoints(id) ON DELETE CASCADE,
  weight      FLOAT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_id, target_id)
);

-- 模型配置
CREATE TABLE user_model_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  usage       VARCHAR(50) NOT NULL, -- 'aggregation'|'synthesis'|'explain'|'embedding'
  base_url    TEXT NOT NULL,
  api_key     TEXT NOT NULL, -- AES-256-GCM 加密
  model_name  VARCHAR(200) NOT NULL,
  UNIQUE (user_id, usage)
);

-- 存储配置
CREATE TABLE user_storage_configs (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  use_custom  BOOLEAN DEFAULT false,
  endpoint    TEXT,
  access_key  TEXT,
  secret_key  TEXT, -- AES 加密
  bucket      TEXT,
  region      VARCHAR(50) DEFAULT 'us-east-1'
);

-- 阅读器设置
CREATE TABLE user_reader_settings (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  font_size   INT DEFAULT 16,
  line_height FLOAT DEFAULT 1.75,
  font_family VARCHAR(20) DEFAULT 'system',
  theme       VARCHAR(20) DEFAULT 'day'
);

-- 发布目标
CREATE TABLE publish_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(200),
  type          VARCHAR(50), -- 'webhook'|'kms'
  endpoint_url  TEXT,
  auth_header   TEXT, -- 加密
  extra_config  JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 发布任务
CREATE TABLE publish_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200),
  viewpoint_ids   UUID[],
  target_id       UUID REFERENCES publish_targets(id),
  format          VARCHAR(20), -- 'markdown'|'pdf'|'html'
  trigger_type    VARCHAR(20), -- 'manual'|'cron'|'on_change'
  cron_expr       VARCHAR(100),
  on_change_delay INT,
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 发布记录
CREATE TABLE publish_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES publish_tasks(id) ON DELETE CASCADE,
  triggered_by    VARCHAR(20),
  status          VARCHAR(20), -- 'SUCCESS'|'FAILED'|'RUNNING'
  error_msg       TEXT,
  article_version VARCHAR(64),
  executed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_highlight_user_status ON highlights (user_id, status);
CREATE INDEX idx_highlight_book ON highlights (book_id, created_at DESC);
CREATE INDEX idx_viewpoint_user ON viewpoints (user_id, sort_order);
CREATE INDEX idx_hv_viewpoint ON highlight_viewpoints (viewpoint_id);
CREATE INDEX idx_hv_highlight ON highlight_viewpoints (highlight_id);
CREATE INDEX idx_vr_source ON viewpoint_relations (source_id, weight DESC);
CREATE INDEX idx_publish_task_user ON publish_tasks (user_id, enabled);

-- pgvector HNSW 索引
CREATE INDEX idx_highlight_embedding ON highlights
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_viewpoint_embedding ON viewpoints
  USING hnsw (summary_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 4. 认证 API

### 4.1 接口清单

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/auth/register` | 注册（邮箱+密码） |
| POST | `/api/auth/login` | 登录，返回 AccessToken + 设置 RefreshToken Cookie |
| POST | `/api/auth/refresh` | 刷新 AccessToken |
| POST | `/api/auth/logout` | 登出，清除 Cookie |
| GET | `/api/account/profile` | 个人信息 |
| PUT | `/api/account/profile` | 修改信息 |
| PUT | `/api/account/password` | 修改密码 |
| GET | `/api/account/export` | 全量数据导出（ZIP） |
| DELETE | `/api/account` | 注销账户 |

### 4.2 JWT 策略

- 算法：RS256（非对称签名）
- Access Token：1 小时有效，在 `Authorization: Bearer` 头传递
- Refresh Token：7 天有效，存 `httpOnly` Cookie
- 中间件注入 `c.set('userId', payload.sub)` 供后续路由使用

### 4.3 密码策略

- 使用 `bcrypt`（cost factor 12）哈希存储
- 注册时强制 8 位以上

---

## 5. 安全设计

| 安全点 | 实现方式 |
|--------|---------|
| API Key 存储 | AES-256-GCM，密钥由 `ENCRYPTION_KEY` 环境变量管理 |
| 用户数据隔离 | 所有 DB 查询中间件强制注入 `user_id` 过滤 |
| MinIO 访问 | 预签名 URL，15 分钟有效，Bucket 私有 |
| 文件类型校验 | 后端校验 Magic Bytes，只接受 PDF/EPUB |
| 文件大小限制 | 单文件 500MB 上限 |
| XSS 防护 | TipTap 输出用 DOMPurify 净化 |
| SQL 注入 | 全部参数化查询 |
| 速率限制 | 认证接口 5次/分钟，AI 接口 30次/分钟（Redis 计数） |

---

## 6. 账户数据导出

```
导出 ZIP 包含：
- books_metadata.json（书籍元数据，不含文件）
- highlights.json（所有划线和批注）
- viewpoints/（每个观点一个 .md 文件）
- settings.json（配置信息，不含 API Key）
```

账户注销流程：
1. 删除 MinIO 中该用户所有文件
2. CASCADE 删除数据库所有关联数据
3. `users` 表软删除（`deleted_at` 设当前时间，保留 30 天）

---

## 7. 验收标准

- [ ] `docker-compose up` 一键启动（PostgreSQL + Redis + MinIO）
- [ ] 执行 `schema.sql` 后所有表和索引创建成功，pgvector 扩展生效
- [ ] 注册 → 登录 → 获取 AccessToken → 访问受保护接口全流程通
- [ ] Refresh Token 机制正常（旧 Token 过期后可刷新）
- [ ] 未携带 Token 访问受保护接口返回 401
- [ ] 数据导出接口返回完整 ZIP
- [ ] AES 加解密工具函数单元测试通过
