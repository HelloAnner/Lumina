# 模块 06：知识库（knowledge-base）

> 阶段：001
> 对应 PRD：§三.2 知识库（Knowledge Base）
> 对应 Tech：§五知识库模块（5.1~5.4）

---

## 1. 模块职责

- 三栏布局：观点文件树 / 文章列表 / 文章正文
- 观点树：树形结构，支持嵌套分组，类似 Notion 文档树
- TipTap 富文本编辑器：展示并编辑 AI 合成的观点文章
- 用户编辑保护：编辑时自动打标 `isUserEdited`，防止 AI 重合成时覆盖
- 自定义 `QuoteBlock` 节点：展示原文引用，点击跳转阅读器
- 关联观点：文章末尾展示与当前观点共享划线的其他观点
- 待确认弱关联划线：展示 similarity 在 0.70~0.85 的划线，用户可手动确认或移除

---

## 2. 三栏布局

```
┌──────────────┬──────────────────────┬─────────────────────┐
│  观点文件树  │     笔记块面板        │  右侧面板            │
│              │                      │  [批注] [对话]       │
│ ▼ 思维框架  │  # 第一性原理思维      │                     │
│   ├ 第一性原则│                     │  批注 Tab:            │
│   └ 长期主义 │  ## 核心论点          │    划词批注 + 列表    │
│ ▶ 商业洞察  │  ...                  │                     │
│ ▶ 投资哲学  │  ## 论据与展开         │  对话 Tab:           │
│              │  ┌────────────────┐  │    选块上下文         │
│ + 新建观点   │  │ 引用块          │  │    消息列表           │
│              │  └────────────────┘  │    输入框             │
│              │                      │                     │
└──────────────┴──────────────────────┴─────────────────────┘
```

---

## 3. 观点树

### 3.1 数据结构

```typescript
interface ViewpointNode {
  id: string
  userId: string
  title: string
  parentId?: string        // 支持嵌套
  sortOrder: number
  highlightCount: number   // 划线数量
  isFolder: boolean        // 是否是分组节点（无文章）
  isCandidate: boolean     // 是否是待升级候选
  summaryEmbedding?: number[]
  lastSynthesizedAt?: Date
  articleContent?: string  // TipTap JSON
}
```

### 3.2 树形渲染

API 返回扁平列表，前端按 `parentId` 递归构建树：

```typescript
// GET /api/viewpoints/tree
// 返回扁平数组，前端 buildTree(nodes)
function buildTree(nodes: ViewpointNode[]): TreeNode[] {
  const map = new Map(nodes.map(n => [n.id, { ...n, children: [] }]))
  const roots: TreeNode[] = []
  for (const node of nodes) {
    if (node.parentId) {
      map.get(node.parentId)?.children.push(map.get(node.id)!)
    } else {
      roots.push(map.get(node.id)!)
    }
  }
  return roots
}
```

### 3.3 交互

- 展开/折叠节点
- 点击节点 → 右侧加载对应文章
- 右键菜单：重命名、新建子主题、移到根目录、删除（快捷键 F2 重命名）
- 拖拽排序（@dnd-kit，支持 before/after/inside/root 四种放置，DragOverlay 预览）
- hover 时显示 `+` 按钮（新建子主题）
- 头部 `+` 按钮固定为「新建根主题」

### 3.4 组件结构

- `ViewpointTree`（`viewpoint-tree.tsx`）：独立树组件，管理拖拽、右键菜单、展开/折叠
- `ContextMenu`（`ui/context-menu.tsx`）：通用右键菜单组件
- `viewpoint-tree-utils.ts`：树构建/移动/序列化的纯函数

---

## 4. TipTap 编辑器

### 4.1 配置

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    QuoteBlock,          // 自定义引用块（见下）
    UserEditExtension,   // 自动打标扩展（见下）
  ],
  content: JSON.parse(viewpoint.articleContent),
  onUpdate: debounce(({ editor }) => {
    saveArticle(editor.getJSON())
  }, 1000),
})
```

### 4.2 留白继续书写

- 文章正文底部的留白区域属于编辑体验的一部分，不是纯展示空白。
- 用户点击最后一个块下方的留白时，编辑器应立即进入可输入状态。
- 光标不应固定落在紧贴正文末尾的下一行，而应根据点击的纵向位置，落到对应高度那一行的行首。
- 如果末尾已经有空段落，则直接聚焦这个空段落。
- 如果点击位置低于当前最后一行，则自动补出足够数量的空段落，让光标落到与点击高度相匹配的新行行首。
- 该交互只在正文主编辑区生效，不影响目录面板、块操作按钮和右侧面板。

### 4.3 自定义 QuoteBlock 节点

```typescript
// 不可分割的原子节点，展示一条划线引用
const QuoteBlock = Node.create({
  name: 'quoteBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      highlightId: { default: null },
      bookTitle: { default: '' },
      chapterName: { default: '' },
      originalText: { default: '' },
      userNote: { default: '' },
      jumpUrl: { default: '' },
    }
  },

  renderHTML({ node }) {
    return ['div', { class: 'quote-block', 'data-highlight-id': node.attrs.highlightId },
      ['div', { class: 'quote-meta' }, `《${node.attrs.bookTitle}》${node.attrs.chapterName}`],
      ['blockquote', {}, node.attrs.originalText],
      node.attrs.userNote ? ['div', { class: 'quote-note' }, `我的批注：${node.attrs.userNote}`] : '',
      ['a', { href: node.attrs.jumpUrl, target: '_blank' }, '跳转原文 ↗'],
    ]
  },
})
```

### 4.4 用户编辑自动打标

```typescript
// TipTap 扩展：监听文档变更，对被修改的段落节点打 isUserEdited = true
const UserEditExtension = Extension.create({
  name: 'userEditTracker',
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, oldState, newState) {
        const tr = newState.tr
        transactions.forEach(transaction => {
          if (!transaction.docChanged) return
          // 找到被修改的段落，打标
          transaction.steps.forEach(step => {
            markAffectedNodes(tr, step, newState.doc)
          })
        })
        return tr.docChanged ? tr : null
      },
    })]
  },
})
```

---

## 5. 关联观点

文章末尾展示与当前观点共享划线最多的其他观点（最多 5 个）：

```sql
SELECT v.id, v.title, COUNT(hv.highlight_id) AS shared_highlights
FROM viewpoint_relations vr
JOIN viewpoints v ON v.id = vr.target_id
LEFT JOIN highlight_viewpoints hv ON hv.viewpoint_id = vr.target_id
WHERE vr.source_id = $1
  AND vr.weight > 0.1
ORDER BY vr.weight DESC
LIMIT 5;
```

---

## 6. 待确认弱关联划线

用户可在文章右侧看到"待确认划线"列表（similarity 在 0.70~0.85，`confirmed = false`）：

- 点击"确认归属" → `confirmed = true`，下次聚合时参与合成
- 点击"移除" → 删除该 `highlight_viewpoints` 记录

```typescript
// GET /api/highlights/:viewpointId/unconfirmed
// PUT /api/highlight-viewpoints/:hId/:vId  { confirmed: true | false }
```

---

## 7. 文章右上角快捷操作

| 操作 | 实现 |
|------|------|
| 发送到邮件 | 调用 `POST /api/viewpoints/:id/send-email` |
| 导出 Markdown | 前端直接：`editor.storage.markdown.getMarkdown()` → 下载 |
| 导出 PDF | 调用 `GET /api/viewpoints/:id/export?format=pdf` → 后端生成 PDF 文件流 |
| 手动推送 | 调用发布模块接口（二期） |

---

## 8. API 清单

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/viewpoints/tree` | 获取观点树（扁平列表） |
| POST | `/api/viewpoints` | 新建观点或分组 |
| GET | `/api/viewpoints/:id` | 观点详情（含文章） |
| PUT | `/api/viewpoints/:id` | 更新标题/位置/排序 |
| DELETE | `/api/viewpoints/:id` | 删除观点 |
| PUT | `/api/viewpoints/:id/article` | 保存文章（用户编辑） |
| GET | `/api/viewpoints/:id/highlights` | 观点下所有划线 |
| GET | `/api/viewpoints/:id/related` | 关联观点 |
| POST | `/api/viewpoints/:id/send-email` | 发送文章到邮件 |
| GET | `/api/viewpoints/:id/export` | 导出（?format=markdown\|pdf） |
| GET | `/api/highlights/:viewpointId/unconfirmed` | 待确认弱关联划线 |
| PUT | `/api/highlight-viewpoints/:hId/:vId` | 确认/取消划线归属 |
| POST | `/api/note-chat/:viewpointId` | 笔记对话（流式 SSE，note_chat 模型） |

---

## 9. 右侧面板（批注 + 对话）

右侧面板支持两个 Tab 切换：

### 9.1 批注 Tab
- 划词批注：选中文字 → 输入修改意见 → AI 处理（annotation_rewrite 模型）
- 对话批注：直接描述补充需求 → AI 处理
- 状态轮询，支持 pending/processing/done/failed 四种状态

### 9.2 对话 Tab
- 选块对话：点击笔记块高亮 → 输入优化指令 → AI 流式返回修改建议 → 手动确认应用
- 新建块：不选块 → 描述需求 → AI 生成新块 → 手动确认插入
- 使用 `note_chat` 模型，流式 SSE 响应
- 对话不持久化，切换观点或刷新后清空
- AI 返回格式：纯文字回复 / JSON action（modify/insert）

### 9.3 组件结构
- `RightSidebar`（`right-sidebar.tsx`）：Tab 容器
- `AnnotationSidebar`（`annotation-sidebar.tsx`）：批注面板
- `ChatSidebar`（`chat-sidebar.tsx`）：对话面板
- `ChatMessage`（`chat-message.tsx`）：消息渲染
- `ChatBlockPreview`（`chat-block-preview.tsx`）：AI 块建议预览

---

## 10. 验收标准

- [ ] 聚合完成后，知识库左侧出现新的观点节点
- [ ] 点击节点，右侧展示合成文章（含 QuoteBlock 引用）
- [ ] QuoteBlock 中"跳转原文"链接正确跳转到阅读器指定位置
- [ ] 手动编辑文章后，再次触发聚合，编辑内容不被覆盖
- [ ] 关联观点正确展示（共享划线的其他观点）
- [ ] 导出 Markdown 内容完整
- [ ] 待确认划线列表展示正确，确认/移除操作生效
- [ ] 右侧面板支持批注/对话 Tab 切换
- [ ] 对话 Tab 可选中块进行针对性优化，AI 流式返回
- [ ] 对话 Tab 可通过描述新建块并插入
- [ ] 设置页可为 note_chat 绑定模型
