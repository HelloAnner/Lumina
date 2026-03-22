# Lumina 全栈实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 从零实现可通过单镜像 Docker 启动的 Lumina 全栈应用，覆盖认证、书库、阅读器、AI 解释、聚合、知识库、图谱、发布、设置全部模块。

**Architecture:** 采用单仓 `Next.js 14 + Hono` 一体化方案：前端页面与 API 共存于一个应用中，Hono 通过 App Router Route Handler 暴露 `/api/*`；数据层以 SQLite 持久化和本地对象存储实现 MVP，保证单镜像部署、开箱可运行，同时保留与 PRD/Tech 一致的模块边界与服务抽象，后续可平滑替换为 PostgreSQL/Redis/MinIO。

**Tech Stack:** Next.js 14、React、TypeScript、Tailwind CSS、shadcn/ui、Hono、Drizzle ORM、SQLite、Zod、TipTap、D3、pdfjs-dist、epubjs、Docker。

---

### Task 1: 初始化工程骨架

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `components.json`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `Makefile`
- Create: `.gitignore`
- Create: `app/**/*`
- Create: `src/**/*`
- Create: `public/**/*`

**Step 1: 建立依赖清单与脚本**
- 定义 `dev`、`build`、`start`、`lint`、`db:push`、`seed`、`test` 脚本。

**Step 2: 建立 Next + Tailwind + shadcn 基础**
- 初始化 `app/layout.tsx`、全局样式、主题变量、基础组件目录。

**Step 3: 建立 Hono 入口**
- 新建 `src/server/app.ts` 与 `app/api/[[...route]]/route.ts`，统一挂载 API 路由。

**Step 4: 建立运行配置**
- 写入 `.env.example`、Docker 构建与 `make start`。

### Task 2: 建立数据层与领域模型

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `src/db/seed.ts`
- Create: `src/db/migrations/*`
- Create: `src/server/repositories/*`
- Create: `src/server/services/storage/*`

**Step 1: 先写基础数据访问测试/种子约束**
- 以仓库级 smoke 测试或脚本验证 schema 可初始化。

**Step 2: 定义核心表结构**
- 建立 users、books、highlights、viewpoints、relations、settings、publish 等表。

**Step 3: 实现仓储层**
- 提供用户、书籍、划线、观点、发布任务等 CRUD。

**Step 4: 实现本地存储抽象**
- 提供文件上传、封面路径、导出文件、伪 presign URL 抽象。

### Task 3: 完成认证与账户模块

**Files:**
- Create: `src/server/routes/auth.ts`
- Create: `src/server/routes/account.ts`
- Create: `src/server/lib/auth.ts`
- Create: `src/server/middleware/*`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `src/store/auth.ts`

**Step 1: 写认证失败用例/流程验证脚本**
- 验证未登录访问受保护接口返回 401。

**Step 2: 实现注册登录刷新登出**
- 使用 JWT + HttpOnly Cookie 存储会话。

**Step 3: 实现账户能力**
- 获取资料、修改密码、数据导出、注销账户。

**Step 4: 实现登录注册 UI**
- 按 `ui.pen` 风格构建认证页面与全局守卫。

### Task 4: 复刻核心导航与书库页 UI

**Files:**
- Create: `app/(dashboard)/layout.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `app/(dashboard)/library/page.tsx`
- Create: `components/library/*`
- Create: `src/lib/mock-cover.ts`

**Step 1: 对照 `ui/ui.pen` 拆解侧栏与书库布局**
- 实现深色主题、220px Sidebar、头部、筛选栏、卡片网格。

**Step 2: 实现书籍接口**
- 列表、详情、上传确认、删除、更新标签。

**Step 3: 实现上传流程**
- 单镜像下改为服务端接收文件并落本地对象目录，同时保留 presign 兼容接口。

**Step 4: 让 UI 接上真实数据**
- 书架卡片、空状态、上传弹窗、筛选条件联动。

### Task 5: 完成阅读器与 AI 即时解释

**Files:**
- Create: `app/(dashboard)/reader/[bookId]/page.tsx`
- Create: `components/reader/*`
- Create: `src/server/routes/books.ts`
- Create: `src/server/routes/highlights.ts`
- Create: `src/server/routes/ai.ts`
- Create: `src/server/services/reader/*`

**Step 1: 写划线保存与读取验证**
- 新建划线后重新获取列表应包含对应数据。

**Step 2: 实现阅读器页面**
- 提供 PDF/EPUB 双模式容器、工具栏、进度条、批注侧栏。

**Step 3: 实现划线/批注/进度 API**
- 保存颜色、批注、进度、跳转定位信息。

**Step 4: 实现 AI 解释流式接口**
- 优先真实模型调用；未配置时返回友好占位解释。

### Task 6: 完成聚合、知识库、图谱模块

**Files:**
- Create: `app/(dashboard)/knowledge/page.tsx`
- Create: `app/(dashboard)/graph/page.tsx`
- Create: `components/knowledge/*`
- Create: `components/graph/*`
- Create: `src/server/routes/viewpoints.ts`
- Create: `src/server/routes/aggregate.ts`
- Create: `src/server/routes/graph.ts`
- Create: `src/server/services/aggregation/*`

**Step 1: 写聚合结果验证场景**
- 给定高亮集合后应创建观点、文章与关系边。

**Step 2: 实现简化聚合引擎**
- 基于关键词/词频与可选 embedding 的策略完成候选观点归并。

**Step 3: 实现知识库三栏页**
- 观点树、文章列表/弱关联、正文编辑、引用跳转。

**Step 4: 实现图谱页**
- D3 渲染节点与边，支持聚焦与筛选。

### Task 7: 完成发布与设置模块

**Files:**
- Create: `app/(dashboard)/publish/page.tsx`
- Create: `app/(dashboard)/settings/page.tsx`
- Create: `components/publish/*`
- Create: `components/settings/*`
- Create: `src/server/routes/publish.ts`
- Create: `src/server/routes/settings.ts`
- Create: `src/server/services/publish/*`

**Step 1: 写模型配置与发布任务基本校验**
- 保存后读取应一致，敏感字段返回掩码。

**Step 2: 实现设置接口与页面**
- 模型配置、存储配置、聚合频率、账户设置。

**Step 3: 实现发布模块**
- 发布目标、发布任务、执行记录、手动触发。

**Step 4: 实现 Markdown/HTML/PDF 导出**
- 支持知识库文章导出与模拟 webhook 推送。

### Task 8: 完成 Docker、种子数据与验收验证

**Files:**
- Modify: `Dockerfile`
- Modify: `Makefile`
- Create: `scripts/start.sh`
- Create: `scripts/verify.sh`
- Create: `README.md`

**Step 1: 写入默认种子数据**
- 首次启动自动生成演示账号与全模块样例数据。

**Step 2: 完成单镜像启动流程**
- `make start` 构建镜像并以 20261 暴露。

**Step 3: 执行完整验证**
- 运行 lint、build、关键接口 smoke test。

**Step 4: 补齐使用说明**
- 记录默认账号、启动方式、数据目录与后续扩展点。
