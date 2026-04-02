# 开发态热加载

## 目标

为 Lumina 提供统一的 `make dev` 开发入口：

- 前端页面修改后立即刷新最新 UI
- `app/`、`src/server/`、`app/api/` 下的后端代码修改后自动重新加载
- PostgreSQL、Redis、MinIO 继续由 Docker 托管，保持环境稳定
- 开发入口尽量零配置，本地执行后即可开始联调

## 方案

`make dev` 采用「宿主机 Next.js 开发进程 + Docker 基础依赖」的组合：

1. 先启动 `lumina-postgres`、`lumina-redis`、`lumina-minio`
2. 再在宿主机执行 `next dev`
3. 为开发进程注入本地依赖默认环境变量，使 API、SSR、Route Handler、Hono 路由都连到同一组开发依赖
4. 如果 `package-lock.json` 比 `node_modules/.package-lock.json` 更新，开发入口先自动执行一次 `npm ci`，保证新增依赖在首轮编译前已同步

之所以不在容器里跑 `next dev`，是因为宿主机文件监听更稳定，前后端代码都能直接复用 Next.js 自带热更新能力，避免额外处理挂载目录、轮询监听和 `node_modules` 同步问题。

## 默认约定

- 默认端口：`20261`
- `APP_URL`：`http://localhost:${PORT}`
- `DATABASE_URL`：`postgresql://lumina:lumina@localhost:25432/lumina`
- `REDIS_URL`：`redis://localhost:26379`
- `MINIO_ENDPOINT`：`http://localhost:29000`
- `DATA_DIR`：`data/app`

如果外部已传入这些环境变量，则开发脚本必须优先尊重显式配置，不覆盖用户输入。

## 验收标准

- 执行 `make dev` 后，能自动拉起开发依赖并启动 Next.js 开发服务器
- 拉取新代码后如果依赖发生变化，执行 `make dev` 不需要手动补跑 `npm install`
- 修改 `components/`、`app/` 下页面代码时，浏览器能看到最新结果
- 修改 `src/server/` 或 `app/api/[[...route]]/route.ts` 时，请求结果能反映最新后端逻辑
- 不影响现有 `make start` 生产式容器启动链路
