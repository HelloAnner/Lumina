# 精细阅读进度

## 目标

把阅读进度从“粗略百分比 + 目录位置”升级为“可定位到具体页面/正文块”的进度记录，并且让进度记录本身拥有稳定的 `id`。

## 适用范围

- 书籍阅读器
- 文章阅读器
- 共享阅读页只读取，不写入

## 数据模型

- 每条进度记录都包含：
  - `id`
  - `resourceType`（`book` / `article`）
  - `resourceId`
  - `progress`
  - `currentPageId`
  - `currentPageIndex`
  - `updatedAt`
- 书籍额外保留：
  - `currentSectionIndex`
  - `currentParagraphIndex`
  - `targetLanguage`

## 约束

- `progress id` 必须稳定，可由资源类型与资源 ID 派生
- 页面恢复优先使用 `currentPageId`，其次再回退到旧字段
- 文章阅读器不能只记滚动百分比，必须能回到上次阅读的正文块附近
- 书籍阅读器不能只依赖目录项索引，必须记录当前阅读页/节对应的实体 ID

## API

- `GET /api/books/:id/progress`
- `PUT /api/books/:id/progress`
- `GET /api/articles/:id/progress`
- `PUT /api/articles/:id/progress`

## 前端行为

- 打开阅读器时，优先恢复到 `currentPageId`
- 阅读过程中按轻量节流写回进度
- 页面顶部百分比继续保留，但只作为概览，不再承担定位职责
