# 笔记编辑器升级：Notion 级编辑体验工程设计

> 对应模块：知识库 - 笔记编辑区域
> 状态：设计方案

---

## 1. 现状与差距

### 1.1 当前架构

自研编辑器，基于原生 `contentEditable="plaintext-only"`，无第三方编辑器依赖。

| 文件 | 职责 |
|------|------|
| `note-block-renderer.tsx` | `EditableText` 组件 + 各块类型视图 + `NoteBlockList` 容器 |
| `knowledge-client.tsx` | 状态管理、保存逻辑、块 CRUD |
| `slash-command-menu.tsx` | `/` 命令浮层 |
| `block-type-registry.ts` | 可创建块类型注册（7 种） |

### 1.2 差距总览

| 能力 | Notion | 当前 | 优先级 |
|------|--------|------|--------|
| 富文本格式（粗体/斜体/删除线/行内代码/链接） | 完整 | 无 | P0 |
| Enter 光标处精确分割 | 完整 | 仅末尾新建空块 | P0 |
| Backspace 块首合并 | 完整 | 仅删除空块 | P0 |
| Undo/Redo | 事务级 | 依赖浏览器原生 | P0 |
| 浮动格式工具栏 | 选中文字后弹出 | 无 | P0 |
| 左侧拖拽手柄 + 菜单 | hover 显示 ⠿ + ＋ | 无 | P1 |
| 块拖拽排序 | 完整 | 无 | P1 |
| 键盘快捷键体系 | 30+ 快捷键 | 仅 Enter/Backspace/Esc | P1 |
| Markdown 快捷输入 | `# ` `> ` `**` `---` 等 | 无 | P1 |
| 多块选择与批量操作 | Esc 选块、Shift 扩展 | 无 | P2 |
| 块移动 Cmd+Shift+↑↓ | 完整 | 无 | P2 |
| Tab 缩进/嵌套 | 结构性嵌套 | 无 | P2 |
| 智能粘贴（HTML 解析、URL→链接） | 完整 | 仅纯文本 | P2 |
| 块复制 Cmd+D | 完整 | 无 | P3 |

---

## 2. 技术选型：TipTap

PRD（§六 技术栈）明确指定 TipTap。

**选择理由**：
- ProseMirror 上层封装，Enter 分割 / Backspace 合并 / Undo/Redo 全部内置
- headless 设计——零预设 CSS，所有 UI 通过 Tailwind 自绘，与 Swan Song 美学完全兼容
- `ReactNodeViewRenderer` 天然支持自定义块（QuoteBlock、InsightBlock 等）以 React 组件渲染
- `BubbleMenu` / `FloatingMenu` / 拖拽手柄均有成熟扩展
- 扩展机制支持 `InputRule`（Markdown 快捷输入）、`KeyboardShortcut`、`ProseMirror Plugin`

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x",
  "@tiptap/pm": "^2.x"
}
```

---

## 3. 数据模型：双向转换

### 3.1 设计原则

```
存储层（NoteBlock[]）  ←→  编辑层（TipTap JSON）
后端 API 不变           前端独享
```

- 后端 API 保持 `NoteBlock[]` 结构不变，AI 聚合 / 批注 / 对话等模块无需改动
- 编辑层使用 TipTap 的 ProseMirror 文档树（嵌套节点 + 行内 marks）
- 读取时 `blocksToTipTapDoc()`，保存时 `tipTapDocToBlocks()`

### 3.2 存储层富文本表示

引入 TipTap 后，块内文本从纯字符串升级为**带格式段列表**。存储层需要承载行内格式信息：

```typescript
/** 行内格式标记 */
interface InlineMark {
  type: 'bold' | 'italic' | 'strike' | 'code' | 'link'
  attrs?: { href?: string }
}

/** 带格式的文本段 */
interface RichTextSegment {
  text: string
  marks?: InlineMark[]
}

/**
 * 文本字段升级：
 *   旧：text: string        → "这是纯文本"
 *   新：richText?: RichTextSegment[]  → [{ text: "这是" }, { text: "粗体", marks: [{ type: "bold" }] }]
 *   text 保留为纯文本降级（向后兼容 + AI 模块消费）
 */
```

**兼容策略**：
- `text` 字段始终保留纯文本版本（strip marks），供 AI 聚合 / 搜索 / 导出使用
- `richText` 字段存储完整格式信息，仅前端编辑器消费
- 旧数据无 `richText` 时，从 `text` 生成单段无格式内容

### 3.3 转换函数

```typescript
/** NoteBlock[] → TipTap Document */
function blocksToTipTapDoc(blocks: NoteBlock[]): JSONContent {
  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    type: 'doc',
    content: sorted.map(blockToNode).filter(Boolean)
  }
}

function blockToNode(block: NoteBlock): JSONContent | null {
  switch (block.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: block.level, blockId: block.id },
        content: richTextToTipTap(block.richText, block.text)
      }
    case 'paragraph':
      return {
        type: 'paragraph',
        attrs: { blockId: block.id },
        content: richTextToTipTap(block.richText, block.text)
      }
    case 'quote':
      return {
        type: 'quoteBlock',
        attrs: {
          blockId: block.id,
          sourceBookTitle: block.sourceBookTitle ?? '',
          sourceLocation: block.sourceLocation ?? '',
          highlightId: block.highlightId ?? null,
        },
        content: richTextToTipTap(block.richText, block.text)
      }
    case 'highlight':
      return {
        type: 'highlightBlock',
        attrs: {
          blockId: block.id,
          label: block.label ?? '',
          sourceBookTitle: block.sourceBookTitle ?? '',
          sourceLocation: block.sourceLocation ?? '',
        },
        content: richTextToTipTap(block.richText, block.text)
      }
    case 'insight':
      return {
        type: 'insightBlock',
        attrs: { blockId: block.id, label: block.label ?? '' },
        content: richTextToTipTap(block.richText, block.text)
      }
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { blockId: block.id, language: block.language ?? '' },
        content: [{ type: 'text', text: block.code || ' ' }]
      }
    case 'divider':
      return { type: 'horizontalRule' }
    // 导入专用块：以只读 NodeView 渲染
    case 'image': case 'callout': case 'task': case 'table':
    case 'mermaid': case 'math': case 'excalidraw': case 'chart':
      return {
        type: 'importedBlock',
        attrs: { blockId: block.id, blockData: JSON.stringify(block) }
      }
    default:
      return null
  }
}

/** RichTextSegment[] → TipTap inline content */
function richTextToTipTap(
  richText: RichTextSegment[] | undefined,
  fallbackText: string | undefined
): JSONContent[] {
  if (richText?.length) {
    return richText.map(seg => ({
      type: 'text',
      text: seg.text,
      marks: seg.marks?.map(m => ({
        type: m.type,
        attrs: m.attrs
      }))
    }))
  }
  if (fallbackText) {
    return [{ type: 'text', text: fallbackText }]
  }
  return []
}

/** TipTap Document → NoteBlock[] */
function tipTapDocToBlocks(doc: JSONContent): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let order = 0
  for (const node of doc.content ?? []) {
    const block = nodeToBlock(node, order++)
    if (block) {
      blocks.push(block)
    }
  }
  return blocks
}
```

---

## 4. UI 视觉规范：对标 Notion，融合 Swan Song

### 4.1 整体页面布局

```
┌──────────────────────────────────────────────────────┐
│                    编辑器内容区                        │
│                                                      │
│          ┌─ 内容最大宽度 720px，居中 ─┐               │
│          │                           │               │
│    ⠿ ＋  │  # 第一性原理思维          │               │
│          │                           │               │
│    ⠿ ＋  │  这个概念源自**亚里士多德** │               │
│          │  的哲学体系...             │               │
│          │                           │               │
│    ⠿ ＋  │  ┌─ 引用块 ─────────────┐ │               │
│          │  │ 蓝线 │ 原文引用       │ │               │
│          │  │      │ "每一个正确..." │ │               │
│          │  │      │ 来源：《从0到1》│ │               │
│          │  └──────────────────────┘ │               │
│          │                           │               │
│          └───────────────────────────┘               │
│                                                      │
│            字数: 1,234 · 已保存                       │
└──────────────────────────────────────────────────────┘
```

**关键布局参数**（对标 Notion）：

| 参数 | 值 | 说明 |
|------|-----|------|
| 内容最大宽度 | `720px` | Notion 默认值，居中对齐 |
| 内容区两侧 padding | `96px` | 为左侧手柄留出空间 |
| 左侧手柄区宽度 | `52px` | ⠿ 和 ＋ 两个按钮 |
| 块间垂直间距 | `2px` | 同类型块之间（如段落-段落） |
| 异类型块间距 | `8px` | 标题-段落、段落-引用等切换 |
| 标题上方额外间距 | `24px`（h1）/ `20px`（h2）/ `16px`（h3） | 视觉层次分隔 |

### 4.2 左侧控制栏：拖拽手柄 + 新建按钮

Notion 最核心的交互入口。每个块 hover 时左侧浮现两个控件。

```
正常状态（无 hover）：        Hover 某块时：

  # 标题文本                  ⠿  ＋  # 标题文本
                              ↑   ↑
  段落文本                    │   └─ 点击：在该块位置打开 / 命令菜单
                              └──── 点击：打开块操作菜单
  段落文本                           拖拽：移动块
```

**⠿ 拖拽手柄**：
- 图标：6 点网格（GripVertical），`14×14px`
- 默认 `opacity: 0`，所在块 hover 时 `opacity: 1`，过渡 `150ms`
- 点击：弹出块操作菜单（Turn into / 复制 / 删除）
- 长按拖拽：拖拽排序
- 光标：`cursor: grab`，拖拽中 `cursor: grabbing`
- 定位：块左侧 `28px`，垂直方向与块第一行文字中线对齐

**＋ 新建按钮**：
- 图标：Plus，`14×14px`
- 点击：聚焦到该块，触发 `/` 命令菜单
- 定位：在 ⠿ 按钮左侧，间距 `2px`

**视觉规范**：

```css
.block-gutter {
  position: absolute;
  left: -52px;
  top: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.block-wrapper:hover .block-gutter {
  opacity: 1;
}

.gutter-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: hsl(var(--muted) / 0.6);
  transition: all 120ms ease;
}

.gutter-button:hover {
  background: hsl(var(--overlay) / 0.8);
  color: hsl(var(--secondary));
}
```

### 4.3 浮动格式工具栏（BubbleMenu）

选中任意文本后，工具栏从选区上方 **fade-in + 微上移** 浮现。

```
                    ┌─────────────────────────────────────────────┐
                    │  Text ▾ │ B  I  S  ‹›  ⌁  │  Turn into ▾  │
                    └─────────────────────────────────────────────┘
                                   ▼
                    "被选中的|一段文字内容"
```

**按钮布局**（从左到右，用 `│` 表示分隔线）：

| 区域 | 按钮 | 功能 | 快捷键提示 |
|------|------|------|-----------|
| 格式 | **B** | 粗体 | `⌘B` |
| 格式 | *I* | 斜体 | `⌘I` |
| 格式 | ~~S~~ | 删除线 | `⌘⇧S` |
| 格式 | `<>` | 行内代码 | `⌘E` |
| 格式 | ⌁ | 链接 | `⌘K` |
| 分隔 | │ | — | — |
| 块操作 | Turn into ▾ | 转换块类型 | — |

**快捷键提示**：hover 按钮时显示 tooltip，格式为 `粗体 ⌘B`，muted 色文字。

**视觉规范**：

```css
.bubble-menu {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px;
  background: hsl(var(--elevated) / 0.95);
  backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid hsl(var(--border) / 0.3);
  border-radius: 10px;
  box-shadow: 0 4px 20px hsl(0 0% 0% / 0.08),
              0 1px 3px hsl(0 0% 0% / 0.04);
  /* 入场动效 */
  animation: bubble-enter 120ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

@keyframes bubble-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.bubble-menu .separator {
  width: 1px;
  height: 20px;
  background: hsl(var(--border) / 0.3);
  margin: 0 2px;
}

.bubble-menu button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--secondary));
  transition: all 100ms ease;
}

.bubble-menu button:hover {
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--foreground));
}

.bubble-menu button.is-active {
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}
```

### 4.4 链接编辑弹层

**创建链接**（Cmd+K 或工具栏 ⌁）：

```
┌─────────────────────────────────┐
│  🔗  粘贴链接或输入 URL          │
│  ┌───────────────────────────┐  │
│  │ https://                  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**已有链接 hover**：

```
┌──────────────────────────────────────┐
│  example.com/article  ↗  │  ✎  │  ✕ │
└──────────────────────────────────────┘
  ↗ 打开链接  ✎ 编辑  ✕ 移除链接
```

定位在链接文字下方 `8px`，居中对齐。样式与 BubbleMenu 同源（毛玻璃背景 + 圆角 10px）。

### 4.5 斜杠命令菜单

输入 `/` 后在光标下方弹出，对标 Notion 的分类列表。

```
┌──────────────────────────────────┐
│  基础块                          │
│  ┌──────────────────────────────┐│
│  │ ¶  段落       正文文本       ││
│  │ H  标题       大标题         ││
│  │ ❝  引用       原文引用块     ││
│  │ ◇  洞察       AI 补充说明    ││
│  │ ⬦  高亮       关键洞察标注   ││
│  │ ⌨  代码       代码块         ││
│  │ ─  分隔线     水平分割线     ││
│  └──────────────────────────────┘│
│  转换为                          │
│  ┌──────────────────────────────┐│
│  │ H1 标题 1                    ││
│  │ H2 标题 2                    ││
│  │ H3 标题 3                    ││
│  └──────────────────────────────┘│
└──────────────────────────────────┘
```

**行为细节**：
- 输入 `/` 后立即弹出，继续输入过滤（支持中文 / 拼音首字母 / 英文）
- ↑↓ 键盘导航，Enter 选择，Escape 关闭
- 宽度 `280px`，最大高度 `360px`，超出滚动
- 每项高度 `40px`：左侧图标 `20×20px` + 右侧标题 + 描述
- 选中项高亮：`bg-primary/8`，图标变 `text-primary`

**视觉规范**：与 BubbleMenu 同源——毛玻璃背景、`border-radius: 10px`、`box-shadow`。

### 4.6 块操作菜单（点击 ⠿ 弹出）

```
┌──────────────────────────┐
│  Turn into        ▸      │
│  ─────────────────────── │
│  复制块           ⌘D     │
│  删除             ⌫      │
└──────────────────────────┘
```

宽度 `220px`，快捷键提示右对齐 muted 色。

---

## 5. 全部块类型 NodeView 规范

### 5.1 统一块包装器

每个块共享相同的外壳结构，确保视觉连续性不割裂：

```tsx
/** 所有块共享的包装器 */
function BlockWrapper({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <NodeViewWrapper
      className={cn(
        'block-wrapper group/block relative',
        // 统一的块间距，通过 CSS 相邻选择器实现邻接感知
        className
      )}
    >
      {/* 左侧控制栏 */}
      <div className="block-gutter">
        <GripButton />
        <PlusButton />
      </div>
      {children}
    </NodeViewWrapper>
  )
}
```

**块间距的邻接感知**（对标 Notion）：

```css
/* 默认块间距 */
.tiptap > * + * {
  margin-top: 2px;
}

/* 标题上方加大间距 */
.tiptap > * + [data-type="heading"] {
  margin-top: 24px;
}

.tiptap > [data-type="heading"] + [data-type="heading"] {
  margin-top: 8px;
}

/* 特殊块（引用/洞察/高亮/代码）上下加大间距 */
.tiptap > * + .custom-block,
.tiptap > .custom-block + * {
  margin-top: 8px;
}

/* 相邻同类特殊块间距缩小（视觉成组） */
.tiptap > .custom-block + .custom-block {
  margin-top: 4px;
}
```

### 5.2 标准文本块

#### Heading（标题）

对标 Notion：大字号、无装饰、上方留白。

```typescript
const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: { default: () => crypto.randomUUID() }
    }
  },
  addKeyboardShortcuts() {
    return {
      // Notion 行为：标题末尾 Enter → 新建段落（非标题）
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection
        if ($from.parent.type.name === 'heading' &&
            $from.parentOffset === $from.parent.content.size) {
          return editor.chain()
            .insertContentAt($from.pos + 1, { type: 'paragraph' })
            .focus($from.pos + 2)
            .run()
        }
        return false
      }
    }
  }
})
```

**视觉规范**：

```css
.tiptap h1 { font-size: 1.875rem; font-weight: 600; line-height: 1.3; color: hsl(var(--foreground)); }
.tiptap h2 { font-size: 1.5rem;   font-weight: 600; line-height: 1.35; color: hsl(var(--foreground)); }
.tiptap h3 { font-size: 1.25rem;  font-weight: 600; line-height: 1.4; color: hsl(var(--foreground) / 0.9); }
```

Placeholder：`标题 1` / `标题 2` / `标题 3`（根据 level）。

#### Paragraph（段落）

```css
.tiptap p {
  font-size: 0.9375rem;  /* 15px */
  line-height: 1.7;
  color: hsl(var(--secondary));
  font-weight: 400;
}
```

Placeholder（首个空段落）：`输入文字，或输入 / 选择块类型`

#### 行内格式渲染

```css
.tiptap strong { font-weight: 600; color: hsl(var(--foreground)); }
.tiptap em { font-style: italic; }
.tiptap s { text-decoration: line-through; color: hsl(var(--muted)); }
.tiptap code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875em;
  padding: 2px 5px;
  border-radius: 4px;
  background: hsl(var(--overlay) / 0.8);
  color: hsl(var(--error));
}
.tiptap a {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-decoration-color: hsl(var(--primary) / 0.3);
  text-underline-offset: 2px;
  transition: text-decoration-color 120ms ease;
}
.tiptap a:hover {
  text-decoration-color: hsl(var(--primary));
}
```

### 5.3 特色块（React NodeView）

这些是 Lumina 独有的块类型，通过 `ReactNodeViewRenderer` 渲染为完整 React 组件。

**关键设计原则：不割裂**
- 所有特色块共享 `BlockWrapper` 结构，拥有相同的左侧控制栏
- 特色块内部文字区域仍然是 TipTap 的 `NodeViewContent`——支持完整的行内富文本编辑
- 光标可以从上方段落无缝流入特色块内部文字区域，再流出到下方段落
- Enter / Backspace 在特色块内的行为与标准块一致

#### QuoteBlock（原文引用）

Lumina 核心块——承载从书籍中摘录的原文。

```
┌─ 3px 蓝色左边线 ─┬─────────────────────────────────┐
│                   │  ❝ 原文引用                      │
│                   │                                  │
│                   │  "每一个正确答案都必然是大多数人    │
│                   │   没有想到的..."                   │  ← NodeViewContent（可编辑）
│                   │                                  │
│                   │  📖 来源：《从0到1》第3章          │
│                   └──────────────────────────────────┘
```

```typescript
const QuoteBlock = Node.create({
  name: 'quoteBlock',
  group: 'block',
  content: 'inline*',  // 可编辑富文本

  addAttributes() {
    return {
      blockId: { default: () => crypto.randomUUID() },
      sourceBookTitle: { default: '' },
      sourceLocation: { default: '' },
      highlightId: { default: null },
    }
  },

  addInputRules() {
    return [
      // 输入 " + 空格 → 转为引用块（对标 Notion 的 " 快捷输入）
      new InputRule({
        find: /^"\s$/,
        handler: ({ state, range }) => {
          state.tr.delete(range.from, range.to)
            .setBlockType(range.from, range.from, this.type)
        }
      })
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuoteBlockView)
  }
})

function QuoteBlockView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className="custom-block">
      <div className={cn(
        'flex overflow-hidden rounded-lg border border-border/30',
        'bg-surface/50 transition-shadow duration-200',
        'focus-within:ring-1 focus-within:ring-accent-blue/20'
      )}>
        <div className="w-[3px] shrink-0 bg-accent-blue" />
        <div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Quote className="h-3 w-3 text-accent-blue/70" />
            <span className="text-[11px] font-medium tracking-wide text-accent-blue/70">
              原文引用
            </span>
          </div>
          <NodeViewContent
            as="div"
            className="text-[13.5px] italic leading-[1.75] text-foreground/75 outline-none"
          />
          {node.attrs.sourceBookTitle && (
            <div className="flex items-center gap-1.5 text-muted/60">
              <BookOpen className="h-2.5 w-2.5" />
              <span className="text-[11px]">
                来源：《{node.attrs.sourceBookTitle}》
                {node.attrs.sourceLocation && ` · ${node.attrs.sourceLocation}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}
```

#### HighlightBlock（关键洞察）

```
┌─ 3px 主色左边线 ──┬─────────────────────────────────┐
│                    │  ◆ 关键洞察                     │
│                    │                                 │
│                    │  第一性原理的核心是回到           │
│                    │  事物最基本的条件...              │  ← NodeViewContent
│                    │                                 │
│                    │  📖 来源：《穷查理宝典》          │
│                    └─────────────────────────────────┘
```

左边线颜色 `bg-primary`，标签 `text-primary`，背景 `bg-primary/3`。结构与 QuoteBlock 同源。

#### InsightBlock（AI 洞察）

```
┌─ 3px 绿色左边线 ──┬─────────────────────────────────┐
│                    │  ◈ AI 补充说明                   │
│                    │                                 │
│                    │  这一思想方法论与伊隆·马斯克的     │
│                    │  决策框架有共通之处...             │  ← NodeViewContent
│                    └─────────────────────────────────┘
```

左边线颜色 `bg-success`，标签 `text-success`，背景 `bg-success/3`。

#### CodeBlock（代码块）

对标 Notion 代码块：顶部语言选择器 + 复制按钮，底部代码区。

```
┌──────────────────────────────────────────────────────┐
│  javascript ▾                              📋 复制   │
│──────────────────────────────────────────────────────│
│  const insight = highlights                          │
│    .filter(h => h.score > 0.85)                      │
│    .map(h => synthesize(h))                          │
└──────────────────────────────────────────────────────┘
```

```typescript
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

const CustomCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: { default: () => crypto.randomUUID() },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  }
})

function CodeBlockView({ node, updateAttributes, extension }: NodeViewProps) {
  const [copied, setCopied] = useState(false)

  return (
    <NodeViewWrapper className="custom-block">
      <div className="overflow-hidden rounded-lg border border-border/30 bg-elevated">
        {/* 顶栏 */}
        <div className="flex items-center justify-between border-b border-border/20 px-4 py-2">
          <select
            value={node.attrs.language || ''}
            onChange={e => updateAttributes({ language: e.target.value })}
            className="bg-transparent text-[11px] text-muted outline-none"
          >
            <option value="">plain text</option>
            {extension.options.lowlight.listLanguages().map((lang: string) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <button
            onClick={() => { /* copy logic */ }}
            className="text-[11px] text-muted/60 hover:text-secondary transition-colors"
          >
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        {/* 代码区 */}
        <pre className="overflow-x-auto p-4">
          <NodeViewContent
            as="code"
            className="text-[13px] leading-relaxed font-mono text-foreground/80 outline-none"
          />
        </pre>
      </div>
    </NodeViewWrapper>
  )
}
```

**Notion 行为对齐**：
- 代码块内 Enter → 换行（不新建块）
- 代码块内 Shift+Enter 或 Cmd+Enter → 跳出代码块，新建段落

#### Divider（分隔线）

```css
.tiptap hr {
  border: none;
  border-top: 1px solid hsl(var(--border) / 0.3);
  margin: 12px 0;
}
```

原子节点（`atom: true`），不可编辑。选中后按 Backspace/Delete 删除。

### 5.4 导入专用块（只读 NodeView）

`image` / `callout` / `task` / `table` / `mermaid` / `math` / `excalidraw` / `chart` 这 8 种块类型仅通过 Obsidian 导入产生，在编辑器中以**只读卡片**渲染。

```typescript
/**
 * 通用导入块容器
 * 将 NoteBlock 完整序列化为 attrs.blockData，由 React NodeView 渲染
 * 不可编辑（atom: true），但可以拖拽、删除
 */
const ImportedBlock = Node.create({
  name: 'importedBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: { default: () => crypto.randomUUID() },
      blockData: { default: '{}' },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImportedBlockView)
  }
})

function ImportedBlockView({ node }: NodeViewProps) {
  const block: NoteBlock = JSON.parse(node.attrs.blockData)
  // 复用现有的 ImportedBlockItem 组件
  return (
    <NodeViewWrapper className="custom-block">
      <ImportedBlockItem block={block} />
    </NodeViewWrapper>
  )
}
```

**不割裂设计**：
- 导入块在视觉上有轻微的 `border-dashed` 提示这是导入内容
- 拖拽手柄正常显示，可以和其他块自由调整顺序
- 点击 ⠿ 菜单可以删除

---

## 6. 核心交互算法

### 6.1 Enter 分割

TipTap 内置 `splitBlock()` 命令。自定义扩展点：

| 场景 | 行为 |
|------|------|
| 段落中间按 Enter | 精确分割为两个段落，光标移到新段落首 |
| 段落末尾按 Enter | 新建空段落 |
| 标题末尾按 Enter | 新建段落（非标题）— 需自定义 |
| 标题中间按 Enter | 分割为两个标题 |
| 引用/洞察/高亮块末尾 Enter | 新建段落（跳出特色块） |
| 代码块内 Enter | 换行（不分割） |
| 代码块内 Shift+Enter | 跳出，新建段落 |
| 空块按 Enter | 新建空段落 |

### 6.2 Backspace 合并

TipTap 内置 `joinBackward()` 命令。自定义扩展点：

| 场景 | 行为 |
|------|------|
| 段落首按 Backspace | 合并到前一个段落，光标在合并点 |
| 空段落按 Backspace | 删除该块，聚焦前块末尾 |
| 标题首按 Backspace | 降级为段落（不合并） |
| 引用/洞察/高亮首按 Backspace | 降级为段落，保留文字（不合并） |
| 代码块首按 Backspace | 降级为段落 |
| 分隔线/导入块被选中后 Backspace | 删除该块 |
| 第一个块首按 Backspace | 无操作 |

```typescript
const BackspaceHandler = Extension.create({
  name: 'backspaceHandler',
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection

        // 非文本选区（NodeSelection）→ 删除节点
        if (editor.state.selection instanceof NodeSelection) {
          return editor.commands.deleteSelection()
        }

        if (!empty) {
          return false // 有选区，使用默认删除
        }

        const isAtStart = $from.parentOffset === 0
        if (!isAtStart) {
          return false
        }

        const parentType = $from.parent.type.name

        // 特殊块首：降级为段落
        const degradeTypes = ['heading', 'quoteBlock', 'insightBlock', 'highlightBlock', 'codeBlock']
        if (degradeTypes.includes(parentType)) {
          // 保留文字内容，只改变节点类型
          return editor.commands.setNode('paragraph')
        }

        // 段落首：执行标准合并
        return false // 让 TipTap 默认的 joinBackward 处理
      }
    }
  }
})
```

### 6.3 拖拽排序

使用 TipTap 的 `@tiptap/extension-global-drag-handle` 或自实现 ProseMirror Plugin。

**拖拽状态机**：

```
idle → (mousedown on handle) → ready → (mousemove > 3px) → dragging → (mouseup) → idle
                                        ↓
                                  渲染 DragOverlay + DropIndicator
```

**DropIndicator 定位算法**：

```typescript
function findDropPosition(view: EditorView, mouseY: number, dragNodePos: number) {
  let bestTarget: { pos: number; rect: DOMRect } | null = null
  let bestDistance = Infinity

  view.state.doc.forEach((node, offset) => {
    if (offset === dragNodePos) {
      return
    }
    const dom = view.nodeDOM(offset)
    if (!dom || !(dom instanceof HTMLElement)) {
      return
    }
    const rect = dom.getBoundingClientRect()
    const midY = rect.top + rect.height / 2

    // 判断鼠标更接近块的上边缘还是下边缘
    const topDist = Math.abs(mouseY - rect.top)
    const bottomDist = Math.abs(mouseY - rect.bottom)
    const minDist = Math.min(topDist, bottomDist)

    if (minDist < bestDistance) {
      bestDistance = minDist
      bestTarget = {
        pos: topDist < bottomDist ? offset : offset + node.nodeSize,
        rect
      }
    }
  })

  return bestTarget
}
```

**Drop Indicator 视觉**：

```css
.drop-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: hsl(var(--primary) / 0.5);
  border-radius: 1px;
  pointer-events: none;
  /* 微妙的呼吸动画 */
  animation: drop-pulse 1.2s ease-in-out infinite;
}

@keyframes drop-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
```

### 6.4 Undo/Redo

TipTap StarterKit 内置 `prosemirror-history`。

```typescript
StarterKit.configure({
  history: {
    depth: 200,         // 最多 200 步
    newGroupDelay: 500,  // 500ms 内连续输入合并为一步
  }
})
```

合并粒度：
- 连续字符输入 → 合并为一步（直到暂停 500ms、移动光标或切换格式）
- 粗体/斜体等格式化操作 → 独立一步
- Enter 分割 → 独立一步
- Backspace 合并 → 独立一步
- 拖拽移动 → 独立一步

### 6.5 键盘快捷键

**格式化**（TipTap 内置）：

| 快捷键 | 功能 |
|--------|------|
| `⌘B` | 粗体 |
| `⌘I` | 斜体 |
| `⌘⇧S` | 删除线 |
| `⌘E` | 行内代码 |
| `⌘K` | 链接 |
| `⌘Z` | 撤销 |
| `⌘⇧Z` | 重做 |

**块操作**（自定义扩展）：

| 快捷键 | 功能 |
|--------|------|
| `⌘⇧↑` | 块上移 |
| `⌘⇧↓` | 块下移 |
| `⌘D` | 复制块 |
| `⌘⌥1` | 转为 H1 |
| `⌘⌥2` | 转为 H2 |
| `⌘⌥3` | 转为 H3 |
| `⌘⌥0` | 转为段落 |
| `Escape` | 选中当前块（进入块选择模式） |

### 6.6 Markdown 快捷输入

TipTap `InputRule`，行首输入 Markdown 语法后自动转换。

| 输入 | 转换为 |
|------|--------|
| `# ` + 空格 | H1 |
| `## ` + 空格 | H2 |
| `### ` + 空格 | H3 |
| `> ` + 空格 | 引用块 |
| `" ` + 空格 | 引用块（别名） |
| `---` | 分隔线 |
| `` `code` `` | 行内代码 |
| `**text**` | 粗体 |
| `*text*` | 斜体 |
| `~~text~~` | 删除线 |

---

## 7. 与现有模块集成

### 7.1 批注系统

```typescript
// 选区变更时通知批注侧栏
editor.on('selectionUpdate', ({ editor }) => {
  const { from, to } = editor.state.selection
  if (from === to) {
    return
  }
  const text = editor.state.doc.textBetween(from, to)
  const $from = editor.state.doc.resolve(from)
  const blockNode = findParentBlockNode($from)
  if (blockNode) {
    onSelectText(blockNode.node.attrs.blockId, text)
  }
})
```

### 7.2 AI 对话

```typescript
/** AI modify action → 替换块内容 */
function applyModifyAction(editor: Editor, blockId: string, newContent: JSONContent[]) {
  let targetPos: number | null = null
  let targetSize = 0

  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.blockId === blockId) {
      targetPos = pos
      targetSize = node.content.size
      return false
    }
  })

  if (targetPos !== null) {
    editor.chain()
      .setTextSelection({ from: targetPos + 1, to: targetPos + 1 + targetSize })
      .insertContent(newContent)
      .run()
  }
}

/** AI insert action → 在块后插入 */
function applyInsertAction(editor: Editor, afterBlockId: string, blocks: NoteBlock[]) {
  let insertPos: number | null = null

  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.blockId === afterBlockId) {
      insertPos = pos + node.nodeSize
      return false
    }
  })

  if (insertPos !== null) {
    const nodes = blocks.map(blockToNode).filter(Boolean)
    editor.chain().insertContentAt(insertPos, nodes).run()
  }
}
```

### 7.3 保存

保存逻辑不变：`editor.getJSON()` → `tipTapDocToBlocks()` → `PUT /api/viewpoints/:id/blocks`。后端零改动。

---

## 8. 组件架构

```
KnowledgeClient
├── ViewpointTree                      （不变）
├── NoteEditor                         （新组件）
│   ├── useNoteEditor()                 TipTap 实例 + 加载/保存
│   ├── EditorContent                   TipTap 渲染主体
│   ├── BubbleToolbar                   浮动格式工具栏
│   │   ├── FormatButtons               B / I / S / Code / Link
│   │   ├── Separator
│   │   └── TurnIntoDropdown            块类型转换下拉
│   ├── SlashCommandMenu                / 命令菜单（升级现有组件）
│   ├── BlockDragHandle                 拖拽手柄 + 操作菜单
│   ├── LinkEditPopover                 链接编辑弹层
│   └── EditorFooter                    字数 · 保存状态
└── RightSidebar                       （不变）
    ├── AnnotationSidebar
    └── ChatSidebar
```

**useNoteEditor Hook**：

```typescript
function useNoteEditor(opts: {
  viewpointId: string
  initialBlocks: NoteBlock[]
  onSaveStatusChange: (s: 'idle' | 'saving' | 'saved') => void
  onSelectText?: (blockId: string, text: string) => void
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: { depth: 200, newGroupDelay: 500 },
        heading: { levels: [1, 2, 3] },
        codeBlock: false,  // 使用 CodeBlockLowlight 替代
      }),
      // 自定义块
      QuoteBlock,
      InsightBlock,
      HighlightBlock,
      CustomCodeBlock,
      ImportedBlock,
      // 行内格式
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener', target: null } }),
      // 交互增强
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return { 1: '标题 1', 2: '标题 2', 3: '标题 3' }[node.attrs.level as number] ?? '标题'
          }
          return '输入文字，或输入 / 选择块类型'
        },
        showOnlyCurrent: true,
      }),
      BlockIdExtension,
      BackspaceHandler,
      BlockMoveShortcuts,
    ],
    content: blocksToTipTapDoc(opts.initialBlocks),
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none max-w-[720px] mx-auto px-4',
      },
    },
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        opts.onSaveStatusChange('saving')
        const blocks = tipTapDocToBlocks(editor.getJSON())
        await fetch(`/api/viewpoints/${opts.viewpointId}/blocks`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ blocks })
        })
        opts.onSaveStatusChange('saved')
      }, 800)
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to && opts.onSelectText) {
        const text = editor.state.doc.textBetween(from, to)
        const $from = editor.state.doc.resolve(from)
        const blockId = $from.parent.attrs?.blockId
        if (blockId) {
          opts.onSelectText(blockId, text)
        }
      }
    }
  })

  // 切换 viewpoint 时加载
  useEffect(() => {
    if (editor) {
      editor.commands.setContent(blocksToTipTapDoc(opts.initialBlocks))
    }
  }, [opts.viewpointId])

  return { editor }
}
```

---

## 9. BlockId 稳定性保障

批注和 AI 对话依赖 `blockId` 定位块。Enter 分割会复制 attrs 导致 ID 重复，必须在 Transaction 层去重。

```typescript
const BlockIdExtension = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [{
      types: [
        'heading', 'paragraph', 'quoteBlock', 'insightBlock',
        'highlightBlock', 'codeBlock', 'importedBlock'
      ],
      attributes: {
        blockId: {
          default: () => crypto.randomUUID(),
          parseHTML: el => el.getAttribute('data-block-id') ?? crypto.randomUUID(),
          renderHTML: attrs => ({ 'data-block-id': attrs.blockId }),
        }
      }
    }]
  },

  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some(tr => tr.docChanged)) {
          return null
        }

        const tr = newState.tr
        const seen = new Set<string>()
        let modified = false

        newState.doc.descendants((node, pos) => {
          const id = node.attrs.blockId
          if (!id) {
            return
          }
          if (seen.has(id)) {
            tr.setNodeMarkup(pos, null, { ...node.attrs, blockId: crypto.randomUUID() })
            modified = true
          }
          seen.add(id)
        })

        return modified ? tr : null
      }
    })]
  }
})
```

---

## 10. 实施阶段

### Phase 1：基础迁移（功能对等）

用 TipTap 替换自研 contentEditable，**不新增任何功能**，确保零退化。

- 安装 TipTap 依赖
- 实现 `blocksToTipTapDoc` / `tipTapDocToBlocks` + 往返测试
- 创建 `NoteEditor` + `useNoteEditor`
- 迁移全部 15 种块类型的 NodeView
- 适配 `/` 命令、auto-save、批注系统、AI 对话系统
- 验收：所有现有功能正常工作

### Phase 2：富文本 + 核心体验

Notion 核心体验补齐。

- 启用行内格式（粗体/斜体/删除线/行内代码/链接）
- BubbleMenu 浮动工具栏
- Markdown 快捷输入（InputRule）
- Enter 精确分割 / Backspace 合并（TipTap 内置，调优特殊块行为）
- Undo/Redo（内置）
- 完整键盘快捷键
- 链接编辑弹层
- 存储层增加 `richText` 字段
- 验收：可以对文字加粗、创建链接、在中间分割块

### Phase 3：块操作

- 左侧拖拽手柄 + ＋ 按钮
- 拖拽排序
- ⠿ 菜单（Turn into / 复制 / 删除）
- Cmd+Shift+↑↓ 块移动
- Cmd+D 复制块
- 验收：可拖拽重排块，通过菜单转换块类型

### Phase 4：高级交互（可选）

- Esc 块选择模式 + Shift 多选
- 多块批量操作
- Tab / Shift+Tab 缩进
- 外部粘贴 HTML 智能解析
- URL 粘贴到选中文字自动创建链接

---

## 11. 注意事项

### 数据兼容

- 转换函数必须覆盖全部 15 种块类型，编写 `editor-transform.test.ts` 验证往返一致性
- 旧数据无 `richText` 字段时自动降级，从 `text` 生成无格式内容
- `text` 字段始终保持纯文本版本，AI 模块不受影响

### 性能

- ProseMirror 在 500+ 节点时可能出现延迟，对超长笔记考虑虚拟化
- 每个 React NodeView 是独立挂载，大量引用块时监控渲染性能
- auto-save debounce 800ms，格式化操作（如加粗）也会触发保存

### 不做的事

- 不引入协同编辑（纯个人工具）
- 不引入 AI 补全（保持编辑的宁静感）
- 不实现 Notion 的数据库/看板
- 不实现页面嵌套（block as page）
- 不添加 emoji 选择器（Swan Song 禁止 emoji）
- 不添加文字颜色/背景色（克制原则）
- 不添加下划线格式（语义弱，与链接样式冲突）
