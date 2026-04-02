# 划线观点流向与定位跳转

> 对应模块：阅读器、知识库
> 状态：实施中

---

## 1. 目标

- 在阅读器右侧「划线与想法」列表中，点击一条已有划线后弹出居中的详情弹窗
- 弹窗展示该划线已经流向哪些观点笔记块，而不是只展示原始文本
- 用户点击任一观点入口后，进入知识库并自动定位到对应块
- 定位失败时仍能打开目标观点，并按 `highlightId` 兜底查找首个关联块

## 2. 交互定义

### 2.1 阅读器侧

- 入口：右侧划线卡片单击
- 形式：居中大弹窗，覆盖阅读器主区与右侧栏
- 内容：
  - 划线原文
  - 来源元信息（书名 / 章节或页面）
  - 该划线流向的观点列表
  - 每个观点项包含：
    - 观点标题
    - 对应块摘要
    - 跳转按钮

### 2.2 跳转行为

- 跳转到 `/knowledge`
- URL 写入：
  - `viewpoint=<viewpointId>`
  - `block=<blockId>`（优先定位）
  - `highlight=<highlightId>`（兜底定位）
- 进入知识库后：
  - 先切换到目标观点
  - 块加载完成后优先定位到 `block`
  - 若 `block` 不存在，则查找首个 `highlightId` 匹配块
  - 命中块添加一层短暂的柔和描边提示

## 3. 数据协议

### 3.1 新增接口

- `GET /api/highlights/:id/references`

返回：

```ts
{
  item: Highlight | null
  references: Array<{
    viewpointId: string
    viewpointTitle: string
    blockId: string
    blockType: "quote" | "highlight" | "image"
    blockText: string
    sourceLocation?: string
  }>
}
```

### 3.2 查询规则

- 先校验高亮属于当前用户
- 遍历已关联的 `highlight_viewpoints`
- 对每个观点读取 `articleBlocks`
- 收集 `highlightId === 当前高亮` 的块
- 仅返回可跳转块：
  - `quote`
  - `highlight`
  - `image`

## 4. 前端状态

### 4.1 阅读器

- 新增 `activeHighlightDetailId`
- 新增 `highlightReferencesLoading`
- 新增 `highlightReferencesData`

### 4.2 知识库

- URL 选择扩展：
  - `viewpoint`
  - `block`
  - `highlight`
- 页面新增一次性跳转目标状态：
  - `pendingJumpBlockId`
  - `pendingJumpHighlightId`
- `NoteEditor` 新增块定位提示参数，负责滚动并施加临时 class

## 5. 不做的事

- 不在本次实现中新增“从观点块反向弹出所有引用去向”
- 不把右侧划线卡片单击同时保留为阅读器内滚动定位
- 不引入新的全局状态管理库

## 6. 验收标准

- 阅读器右侧划线卡片点击后出现居中大弹窗
- 弹窗可列出该高亮关联的多个观点块
- 点击任一观点入口后，知识库自动打开目标观点
- 知识库能滚动到目标块并做短暂提示
- 目标块缺失时，仍可按 `highlightId` 找到首个关联块并定位
