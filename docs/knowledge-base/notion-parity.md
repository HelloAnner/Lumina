# 笔记编辑器 Notion 对标全量实施方案

> 对应模块：知识库 - 笔记编辑器
> 状态：Phase 1-5 已落地，Phase 6 待后续迭代
> 目标：将编辑器从"能用"提升到 Notion 级体验与性能

---

## 总览

当前编辑器基于 TipTap 2.x，已具备基础富文本编辑能力。与 Notion 的差距集中在三个层面：

1. **Block 类型严重不足** — 列表、待办、Toggle、可编辑表格/图片等基础类型缺失
2. **交互体验粗糙** — 无多块选中、无嵌套缩进、无智能粘贴、Markdown 快捷输入不全
3. **性能瓶颈** — 全量序列化、全量 PUT、热状态上提导致大文档卡顿

以下按实施顺序排列，每个阶段可独立验收。

---

## Phase 1：基础 Block 类型补齐

### 1.1 无序列表 (Bullet List)

**目标**：`- ` 或 `* ` 触发无序列表，支持多级嵌套（Tab/Shift+Tab）

**实现方案**：
- 安装 `@tiptap/extension-bullet-list` + `@tiptap/extension-list-item`
- 在 StarterKit 中启用（StarterKit 自带，当前可能被禁用）
- 添加 InputRule：`- ` → bulletList
- 添加 slash command：`/无序列表`
- 数据模型：新增 `BulletListBlock` 类型，含 `items: ListItem[]`
- 双向转换：`blocksToTipTapDoc` / `tipTapDocToBlocks` 新增 bulletList 映射

**验收**：
- [ ] `- ` 自动转为列表
- [ ] Tab 缩进，Shift+Tab 减少缩进
- [ ] Enter 新建列表项，空列表项 Enter 退出列表
- [ ] Backspace 在列表项开头降级为段落
- [ ] slash 命令可插入
- [ ] 保存后重新加载内容不丢失

### 1.2 有序列表 (Ordered List)

**目标**：`1. ` 触发有序列表

**实现方案**：
- 安装 `@tiptap/extension-ordered-list`（或 StarterKit 内置启用）
- InputRule：`1. ` → orderedList
- slash command：`/有序列表`
- 数据模型：新增 `OrderedListBlock`
- 双向转换同上

**验收**：
- [ ] `1. ` 自动转为有序列表
- [ ] 序号自动递增
- [ ] Tab/Shift+Tab 嵌套
- [ ] 保存恢复正确

### 1.3 待办列表 (Task List)

**目标**：`[] ` 或 `[ ] ` 触发待办列表，checkbox 可点击切换

**实现方案**：
- 安装 `@tiptap/extension-task-list` + `@tiptap/extension-task-item`
- InputRule：`[] ` → taskList
- slash command：`/待办`
- 数据模型：复用现有 `TaskBlock` 或新增 `TaskListBlock`
- NodeView：自定义 checkbox 样式，对齐 Swan Song 美学

**验收**：
- [ ] `[] ` 自动转为待办
- [ ] checkbox 可点击
- [ ] 支持嵌套
- [ ] 保存恢复正确

### 1.4 Callout 块（可编辑）

**目标**：将现有只读 Callout 升级为可编辑块

**实现方案**：
- 创建 `CalloutBlock` TipTap Node（`group: "block"`, `content: "block+"`）
- ReactNodeView：左侧 icon + 可编辑内容区
- slash command：`/提示` `/callout`
- 支持类型切换：info / warning / tip / danger
- 数据模型：复用现有 `CalloutBlock`，`children` 字段存储子块

**验收**：
- [ ] slash 命令插入 callout
- [ ] 内部可编辑文本
- [ ] 可切换 callout 类型
- [ ] 保存恢复正确

### 1.5 Toggle 块（折叠块）

**目标**：可折叠/展开的内容块

**实现方案**：
- 创建 `ToggleBlock` TipTap Node（`content: "block+"`）
- ReactNodeView：三角箭头 + 标题行，点击折叠/展开子内容
- slash command：`/折叠` `/toggle`
- 数据模型：新增 `ToggleBlock` 类型，含 `title: string`, `children: NoteBlock[]`

**验收**：
- [ ] 可插入 toggle
- [ ] 点击折叠/展开
- [ ] 标题和内容均可编辑
- [ ] 保存恢复正确（含折叠状态）

---

## Phase 2：图片与媒体

### 2.1 图片块（可编辑）

**目标**：支持粘贴、拖入、点击上传图片

**实现方案**：
- 安装 `@tiptap/extension-image` 或自定义 Image Node
- ReactNodeView：图片预览 + 拖拽调整宽度 + alt 文本编辑 + 删除
- 上传流程：粘贴/拖入 → 本地预览 → 上传 MinIO → 替换为 objectKey URL
- slash command：`/图片`
- 数据模型：复用现有 `ImageBlock`

**验收**：
- [ ] 粘贴图片自动上传
- [ ] 拖入图片自动上传
- [ ] 点击按钮选择文件上传
- [ ] 图片宽度可拖拽调整
- [ ] 保存恢复正确

### 2.2 嵌入块 (Embed / Bookmark)

**目标**：粘贴 URL 自动生成 bookmark 卡片或嵌入预览

**实现方案**：
- 创建 `EmbedBlock` Node
- 检测粘贴的 URL：视频 → iframe embed，普通链接 → bookmark 卡片（抓取 og:title/description/image）
- slash command：`/嵌入` `/embed`
- 数据模型：新增 `EmbedBlock` 类型

**验收**：
- [ ] 粘贴 URL 提示创建 bookmark
- [ ] bookmark 卡片显示标题、描述、favicon
- [ ] YouTube/Bilibili URL 嵌入 iframe

---

## Phase 3：Markdown 快捷输入补全

### 3.1 补全 InputRule

当前仅支持 `> ` 和 `" ` 转引用。需要补全：

| 输入 | 效果 | 状态 |
|------|------|------|
| `- ` / `* ` | 无序列表 | Phase 1 新增 |
| `1. ` | 有序列表 | Phase 1 新增 |
| `[] ` / `[ ] ` | 待办列表 | Phase 1 新增 |
| `# ` / `## ` / `### ` | 标题 1/2/3 | 检查 StarterKit 是否已启用 |
| `---` | 分隔线 | 检查 StarterKit 是否已启用 |
| ` ``` ` | 代码块 | 检查是否已启用 |
| `> ` | 引用块 | 已有 |

### 3.2 行内 Markdown 快捷

| 输入 | 效果 |
|------|------|
| `**text**` | 加粗 |
| `*text*` / `_text_` | 斜体 |
| `` `code` `` | 行内代码 |
| `~~text~~` | 删除线 |

**实现**：StarterKit 已包含这些 InputRule，确认启用即可。

---

## Phase 4：交互体验提升

### 4.1 多块选中

**目标**：Shift+Click 范围选中多个 block，支持批量删除/拖动/转换类型

**实现方案**：
- 使用 ProseMirror 的 `NodeSelection` 或自定义 `MultiNodeSelection`
- Shift+Click 计算起止 block 范围，添加选中态 CSS class
- 选中后 Bubble Toolbar 显示批量操作：删除、Turn Into
- Delete/Backspace 删除所有选中块
- 拖拽移动所有选中块

**验收**：
- [ ] Shift+Click 选中范围
- [ ] 选中态视觉反馈
- [ ] 批量删除
- [ ] 批量拖动

### 4.2 智能粘贴

**目标**：从浏览器/Word/Notion 粘贴 HTML 时，解析为对应 block 结构

**实现方案**：
- 拦截 `paste` 事件，检测 `clipboardData` 中的 `text/html`
- 解析 HTML DOM → 映射为 TipTap 节点
- URL 粘贴到空段落 → 提示转换为 bookmark
- 图片粘贴 → 上传流程

**验收**：
- [ ] 从 Notion 复制粘贴保持格式
- [ ] 从浏览器复制 HTML 保持基本格式
- [ ] 纯 URL 粘贴提示转 bookmark

### 4.3 可编辑表格

**目标**：支持创建和编辑表格

**实现方案**：
- 安装 `@tiptap/extension-table` + `@tiptap/extension-table-row` + `@tiptap/extension-table-cell` + `@tiptap/extension-table-header`
- slash command：`/表格`
- 表格浮动工具栏：添加行/列、删除行/列、合并单元格
- 数据模型：复用/升级现有 `TableBlock`

**验收**：
- [ ] slash 命令插入 3x3 表格
- [ ] Tab 在单元格间跳转
- [ ] 可添加/删除行列
- [ ] 保存恢复正确

### 4.4 数学公式编辑

**目标**：支持输入和实时预览 LaTeX 公式

**实现方案**：
- 安装 `@tiptap/extension-mathematics` 或自定义 MathBlock Node
- 使用 KaTeX 渲染
- 编辑模式：点击公式进入 LaTeX 编辑，失焦渲染
- 行内公式：`$...$`，块级公式：`$$...$$`
- slash command：`/公式`

**验收**：
- [ ] `$$` 触发公式块
- [ ] LaTeX 实时预览
- [ ] 保存恢复正确

---

## Phase 5：性能优化

> 此阶段与 `editor-performance-refactor.md` 对齐，在此统一跟踪。

### 5.1 消除全量序列化

**问题**：每次按键 → `editor.getJSON()` → `tipTapDocToBlocks()` → 全量 JSON.stringify 比较

**方案**：
- 编辑器内部状态留在 TipTap/ProseMirror，不回传 `NoteBlock[]`
- 仅在保存时执行一次 `tipTapDocToBlocks()`
- 块操作（插入/删除/转换）通过 ProseMirror transaction 完成，不用 `setContent`

### 5.2 KnowledgeClient 解耦

**问题**：`blocks` 作为页面级状态，每次编辑触发整页重渲染

**方案**：
- 删除 `KnowledgeClient` 中的 `blocks` 状态
- 编辑器自管理内部状态
- 侧边栏通过 ref/callback 按需获取块数据，不监听每次更新

### 5.3 保存链路优化

**问题**：全量 PUT 整个 blocks 数组

**方案**：
- 短期：保持全量 PUT，但将防抖从 800ms 调到 1500ms，减少保存频率
- 中期：增量 patch — 只发送变更的 block
- `keepalive` 兜底保存保留

### 5.4 DOM 读写节制

**问题**：hover/outline/class-sync 高频 DOM 查询

**方案**：
- heading 位置缓存 + `IntersectionObserver` 替代 scroll 计算
- gutter 定位用 `IntersectionObserver` 或 ProseMirror decoration
- 块 class 同步走 ProseMirror decoration 而非直接 DOM 操作

### 5.5 大文档虚拟化（P3）

**问题**：1000+ block 全量 DOM 渲染

**方案**：
- 超过 200 block 时启用视窗内渲染
- 方案待选：ProseMirror 原生 viewport 管理 / 自定义虚拟化层

---

## Phase 6：细节打磨

### 6.1 拖拽体验优化

- 拖拽时显示 block 预览（ghost element）
- 多块拖拽支持
- 跨缩进级别拖拽
- 拖拽动画更流畅（spring 缓动）

### 6.2 @ 提及

- 输入 `@` 弹出搜索面板
- 可搜索其他 viewpoint 页面
- 插入为 inline mention（点击可跳转）

### 6.3 行内评论

- 选中文本 → 添加评论
- 评论以线程形式显示在右侧
- 解决后评论高亮消失

### 6.4 移动端适配

- 触摸友好的 block 操作
- 简化的浮动工具栏
- 手势拖拽排序

---

## 实施顺序与依赖

```
Phase 1 (Block 类型)     ──→  Phase 3 (Markdown 快捷)
    ↓
Phase 2 (图片/媒体)
    ↓
Phase 4 (交互体验)      ←──  Phase 5 (性能) [可并行]
    ↓
Phase 6 (打磨)
```

Phase 1 是基础，后续所有阶段都依赖于此。Phase 5 性能优化可以与 Phase 2-4 并行推进。

---

## 需要新增的 TipTap 扩展

```bash
npm install @tiptap/extension-bullet-list @tiptap/extension-ordered-list @tiptap/extension-list-item @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-image @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

> 注：部分扩展（bullet-list, ordered-list, list-item）已包含在 StarterKit 中，需要确认当前是否显式禁用了。

---

## 需要变更的数据模型

`NoteBlockType` 新增：
- `"bullet-list"` — 无序列表
- `"ordered-list"` — 有序列表
- `"task-list"` — 待办列表
- `"toggle"` — 折叠块
- `"embed"` — 嵌入/书签

`NoteBlock` 新增接口：
- `BulletListBlock` / `OrderedListBlock` / `TaskListBlock` — 含 `items` 数组
- `ToggleBlock` — 含 `title`, `children`
- `EmbedBlock` — 含 `url`, `title`, `description`, `favicon`, `embedType`
