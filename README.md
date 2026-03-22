# Lumina

单镜像部署的智能阅读知识库 Demo，覆盖：

- 账号系统
- 书库
- 阅读器
- AI 即时解释
- 划线聚合
- 知识库
- 图谱
- 发布
- 设置

## 本地开发

```bash
npm install
npm run dev
```

默认地址：`http://localhost:3000`

默认演示账号：

- 邮箱：`demo@lumina.local`
- 密码：`lumina123`

## Docker 启动

```bash
make start
```

启动后访问：`http://localhost:20261`

数据会持久化在仓库根目录的 `data/`，目录结构如下：

- `data/app`：应用本地业务数据
- `data/postgres`：PostgreSQL 数据
- `data/redis`：Redis 持久化数据
- `data/minio`：MinIO 对象数据
- `data/minio-config`：MinIO 配置

默认会一起启动这些技术组件，并加入同一个 `lumina-network`：

- `lumina-app`
- `lumina-postgres`
- `lumina-redis`
- `lumina-minio`

## 基础性能配置

当前 Compose 默认按“至少 100 人在线”的基础目标给出一套保守配置：

- 应用容器：`2 CPU / 2GB RAM`
- PostgreSQL：`2 CPU / 2GB RAM`，`max_connections=300`
- Redis：`1 CPU / 512MB RAM`
- MinIO：`1 CPU / 1GB RAM`

建议宿主机至少预留 `4C8G` 可用资源。

## 主要实现说明

- 前端：`Next.js App Router`
- API：`Hono`，统一挂载在 `app/api/[[...route]]/route.ts`
- 持久化：本地 JSON 数据库 + 本地上传目录
- 发布：支持 Webhook/KMS 目标配置与手动触发
- 导出：支持 Markdown / PDF

## 验证

```bash
npm run lint
npm run build
npm run verify
```
