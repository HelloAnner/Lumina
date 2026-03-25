# 模块 07：知识图谱（graph）

> 阶段：001
> 对应 PRD：§三.3 知识图谱（Graph）
> 对应 Tech：§七知识图谱（D3.js）

---

## 1. 模块职责

- 只读可视化：展示所有观点文章之间的关联关系
- D3.js 力导向图：节点 = 观点，边 = 共享划线
- 节点大小 = 划线数量权重；边宽度 = Jaccard 系数权重
- 交互：缩放、拖拽画布、点击节点跳转知识库
- 筛选：按书籍、按时间范围筛选可见节点
- 聚焦模式：点击节点，高亮其一二级关联，其余节点淡化

> 本模块属于二期功能，PRD 明确标注。001 阶段完成完整实现。

---

## 2. 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  筛选：[全部书籍 ▼]  [时间范围 ▼]          [重置布局]         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    D3 力导向图 SVG                            │
│                                                              │
│         ●大节点                                              │
│        / \                                                   │
│       ●   ●小节点                                            │
│            \                                                 │
│             ●                                                │
│                                                              │
│  节点 hover 时显示 tooltip（观点标题 + 划线数）               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据接口

```typescript
// GET /api/graph?bookId=xxx&startDate=xxx&endDate=xxx
interface GraphResponse {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphNode {
  id: string
  title: string
  highlightCount: number    // 决定节点半径：r = 8 + count * 1.5（max 40）
  bookIds: string[]         // 来源书籍（用于筛选）
  lastSynthesizedAt: string
}

interface GraphLink {
  source: string
  target: string
  weight: number            // Jaccard 系数，决定边宽：strokeWidth = 1 + weight * 5
}
```

---

## 4. D3.js 力导向图实现

### 4.1 力导向配置

```typescript
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links)
    .id(d => d.id)
    .distance(d => 150 / (d.weight + 0.1))   // 权重越大，节点越近
  )
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(d => d.r + 10))
```

### 4.2 节点渲染

```typescript
const node = svg.selectAll('circle')
  .data(nodes)
  .join('circle')
  .attr('r', d => Math.min(8 + d.highlightCount * 1.5, 40))
  .attr('fill', '#6366f1')
  .attr('stroke', '#fff')
  .attr('stroke-width', 2)
  .call(d3.drag()
    .on('start', dragStarted)
    .on('drag', dragged)
    .on('end', dragEnded)
  )
  .on('click', (event, d) => {
    router.push(`/knowledge-base?viewpoint=${d.id}`)
  })
  .on('mouseover', (event, d) => showTooltip(event, d))
  .on('mouseout', hideTooltip)
```

### 4.3 边渲染

```typescript
const link = svg.selectAll('line')
  .data(links)
  .join('line')
  .attr('stroke', '#94a3b8')
  .attr('stroke-opacity', 0.6)
  .attr('stroke-width', d => 1 + d.weight * 5)
```

### 4.4 缩放

```typescript
const zoom = d3.zoom()
  .scaleExtent([0.2, 5])
  .on('zoom', event => {
    g.attr('transform', event.transform)
  })
svg.call(zoom)
```

---

## 5. 聚焦模式

```typescript
function focusNode(nodeId: string) {
  // 找出一二级关联节点集合
  const connected = new Set<string>([nodeId])
  links.forEach(l => {
    if (l.source.id === nodeId) connected.add(l.target.id)
    if (l.target.id === nodeId) connected.add(l.source.id)
  })

  // 非关联节点淡化
  node.attr('opacity', d => connected.has(d.id) ? 1 : 0.1)
  link.attr('opacity', d =>
    connected.has(d.source.id) && connected.has(d.target.id) ? 0.8 : 0.05
  )

  // 节点标签高亮
  label.attr('opacity', d => connected.has(d.id) ? 1 : 0.1)
}

// 点击空白区域退出聚焦模式
svg.on('click', () => {
  node.attr('opacity', 1)
  link.attr('opacity', 0.6)
  label.attr('opacity', 1)
})
```

---

## 6. 筛选逻辑

筛选在前端完成（无需重新请求），通过控制节点/边的 `display` 属性实现：

```typescript
function applyFilter(bookId?: string, startDate?: Date, endDate?: Date) {
  const visibleNodes = new Set(
    allNodes
      .filter(n => !bookId || n.bookIds.includes(bookId))
      .filter(n => !startDate || new Date(n.lastSynthesizedAt) >= startDate)
      .filter(n => !endDate || new Date(n.lastSynthesizedAt) <= endDate)
      .map(n => n.id)
  )

  node.attr('display', d => visibleNodes.has(d.id) ? null : 'none')
  link.attr('display', d =>
    visibleNodes.has(d.source.id) && visibleNodes.has(d.target.id) ? null : 'none'
  )
}
```

---

## 7. API 清单

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/graph` | 图谱数据（支持 bookId、startDate、endDate 筛选参数） |

---

## 8. 验收标准

- [ ] 图谱页面正常渲染，所有观点节点可见
- [ ] 节点大小与划线数量成正比
- [ ] 边宽度与 Jaccard 权重成正比
- [ ] 鼠标滚轮缩放、拖拽画布流畅
- [ ] 点击节点跳转到知识库对应文章
- [ ] 点击节点进入聚焦模式，无关节点淡化
- [ ] 按书籍筛选后，只显示来自该书的观点节点和相关边
- [ ] 节点数量较多（100+）时渲染无明显卡顿
