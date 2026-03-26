# 阅读分享链接

## 目标

为书籍阅读页与文章阅读页提供可直接复制的分享链接。分享对象点击后，直接进入对应阅读页面，不经过中转页，视觉结构与当前阅读页保持一致。

## 范围

- 阅读器右上角新增分享入口
- 选择有效期后立即生成并复制链接
- 后端新增独立分享模块，负责创建、校验、解析分享链接
- 新增全局分享地址配置：IP 与端口
- 分享页以只读方式打开原阅读器页面，保留排版、主题、目录与高亮面板

## 交互

### 书籍 / 文章阅读页

- 顶栏右上角新增分享图标
- 点击后展开轻量面板，提供：
  - 24 小时
  - 7 天
  - 30 天
  - 永久有效
- 选择后立即：
  1. 调用后端创建分享链接
  2. 自动复制到剪贴板
  3. Toast 提示复制成功

### 分享访问页

- 路径：`/share/{token}`
- 若 token 有效，直接渲染书籍阅读页或文章阅读页
- 页面结构与原阅读器一致，但以只读模式打开：
  - 不写入阅读进度
  - 不创建 / 删除划线
  - 不展示划线相关 UI
  - 译文只读取数据库中已缓存的翻译结果，不在匿名态触发新的翻译任务
  - 主题默认跟随打开者系统主题；打开者手动切换后写入其本地 storage，后续再次打开分享链接复用该偏好
  - 保留目录、正文、排版、主题切换与译文切换
- 若 token 失效或资源不存在，返回 404

## 数据模型

### 分享地址配置

全局单例配置：

- `host`: 分享出口 IP / 域名
- `port`: 端口

默认值：

- `host`: 宿主机局域网 IPv4
- `port`: `80`

### 分享链接

- `id`
- `token`
- `ownerUserId`
- `resourceType`: `book | article`
- `resourceId`
- `expiresAt?`
- `createdAt`
- `lastAccessedAt?`
- `revokedAt?`

## 后端设计

### 独立模块

新增 `src/server/services/share/`：

- 地址配置默认值与链接拼装
- token 生成
- 过期校验
- 资源解析

新增 `src/server/routes/shares.ts`：

- `POST /api/shares`：创建分享链接
- `GET /api/shares/public/:token/file`：公开读取 PDF 原文件
- `GET /api/shares/public/:token/page-images/:pageNumber`：公开读取 PDF 页图

### 设置接口

新增：

- `GET /api/settings/share-endpoint`
- `PUT /api/settings/share-endpoint`

## 约束

- 分享链接只读，不允许匿名写入 owner 数据
- 分享地址配置为全局配置，不按用户隔离
- 端口为 `80` 时生成的链接省略端口
