# 阅读器架构专题

> 来源：`docs/2026-03-23-lumina-enterprise-system-solution.md` 的阅读器专项拆分  
> 日期：2026-03-23

## 1. 目标

阅读器需要解决四类问题：

1. 正文可读
2. 定位稳定
3. 高亮可靠
4. 布局与偏好可记忆

## 2. 推荐分层

```text
Reader Shell
  ├─ Header
  ├─ Toc Sidebar
  ├─ Main Renderer
  ├─ Highlight Sidebar
  ├─ Selection Toolbar
  ├─ Note Composer
  └─ Font Panel

Reader Services
  ├─ Locator Resolver
  ├─ Progress Tracker
  ├─ Highlight Mapper
  └─ Preference Persistence
```

## 3. 当前实现边界

- `reader-client.tsx` 作为容器组件，负责状态编排
- 目录树、正文渲染、浮层、字体面板、划线面板应该拆成独立模块
- 跳转统一走直接定位，不允许平滑动画

## 4. 目录与导航

- 目录树需要支持滚动
- 当前章节变化时，目录项自动滚到可视区
- 点击目录项直接跳到目标章节

## 5. 正文渲染

- Vertical 模式：连续滚动
- Horizontal 模式：章内段落窗口
- 高亮渲染必须发生在正文原文中，而不是只在侧栏显示

## 6. 浮层与面板

- Selection Toolbar 跟随选区，但坐标系必须相对阅读区自身
- Font Panel 独立管理显示状态
- Highlight Sidebar 点击后直接回跳原文

## 7. 演进路线

1. 当前：规整文本渲染 + 段落偏移定位
2. 下一步：统一 Locator Resolver
3. 后续：EPUB CFI / PDF.js textLayer
