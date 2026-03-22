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
┌──────────────┬────────────────┬──────────────────────────────────┐
│  观点文件树  │   （文章列表）  │           文章正文                │
│              │（本期暂不实现，│  # 第一性原理思维                  │
│ ▼ 思维框架  │ 后续观点有版本  │                                   │
│   ├ 第一性原则│ 时再加）       │  ## 核心论点                      │
│   └ 长期主义 │               │  ...                               │
│ ▶ 商业洞察  │               │  ## 论据与展开                     │
│ ▶ 投资哲学  │               │  ┌──────────────────────────────┐  │
│              │               │  │ 《从0到1》第3章               │  │
│ + 新建观点   │               │  │ "原文引用..."                 │  │
│              │               │  │ 我的批注：...  跳转原文 ↗     │  │
│              │               │  └──────────────────────────────┘  │
│              │               │                                    │
│              │               │  关联观点：[长期主义] [系统思维]   │
│              │               │                                    │
│              │               │  [发送邮件] [导出MD] [导出PDF]    │
└──────────────┴────────────────┴──────────────────────────────────┘
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
- 右键菜单：重命名、新建子节点、删除
- 拖拽排序（`sortOrder` 更新）

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

### 4.2 自定义 QuoteBlock 节点

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

### 4.3 用户编辑自动打标

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

---

## 9. 验收标准

- [ ] 聚合完成后，知识库左侧出现新的观点节点
- [ ] 点击节点，右侧展示合成文章（含 QuoteBlock 引用）
- [ ] QuoteBlock 中"跳转原文"链接正确跳转到阅读器指定位置
- [ ] 手动编辑文章后，再次触发聚合，编辑内容不被覆盖
- [ ] 关联观点正确展示（共享划线的其他观点）
- [ ] 导出 Markdown 内容完整
- [ ] 待确认划线列表展示正确，确认/移除操作生效
