# Lumina 企业级系统方案

> 版本：v1.0  
> 日期：2026-03-23  
> 适用范围：Lumina 当前 MVP 到企业级可持续演进阶段  
> 目标：把书籍导入、阅读、划线、知识沉淀、图谱、发布整合成一套可维护、可演进、可验证的系统方案

---

## 1. 方案目标

Lumina 不是一个“能看书、能做高亮”的玩具，而是一套面向长期迭代的个人知识沉淀系统。系统目标分为四层：

1. **阅读层**
   - 支持 PDF / EPUB 的稳定阅读
   - 保证正文可读性、定位准确性、跳转稳定性
   - 划线、批注、回跳原文必须可追踪、可恢复

2. **知识层**
   - 划线不是终点，观点才是组织单元
   - 支持多书聚合、观点文章生成、观点树沉淀
   - 支持观点间关联关系与图谱表达

3. **系统层**
   - 可替换解析器、阅读内核、模型接入
   - 数据结构和定位模型可向更强方案平滑升级
   - 关键链路具备测试、回退、兜底处理

4. **工程层**
   - 默认本地 JSON / 本地文件 / 单镜像部署完成 MVP
   - 逐步演进到 PostgreSQL + MinIO + Redis + 队列任务
   - 任何能力升级不能破坏现有数据与已有阅读体验

---

## 2. 核心原则

### 2.1 第一性原则

- 先保证功能稳定与可解释，再谈视觉和高级能力
- 优先做可维护的中等复杂方案，拒绝一次性过度设计
- 所有“阅读体验问题”优先从内容结构和定位模型解决，而不是仅靠 CSS 掩盖

### 2.2 企业级原则

- 不依赖脆弱正则实现核心解析
- 不把跳转建立在纯文本模糊匹配上
- 不把高亮、目录、正文渲染绑死在单个组件里
- 所有关键行为必须有可回归验证

### 2.3 当前仓库约束

- 中文沟通、中文注释、英文日志
- UI 贴合 `ui/ui.pen` 的深色极简风格
- 单镜像部署优先
- 阅读器交互默认禁止平滑动画

---

## 3. 系统边界

Lumina 当前系统包含以下一级模块：

1. **书库（Library）**
   - 上传 PDF / EPUB
   - 元数据提取、章节提取、封面、目录、正文规整

2. **阅读器（Reader）**
   - PDF / EPUB 阅读
   - 阅读进度
   - 高亮 / 批注 / 回跳原文
   - 排版设置与阅读偏好

3. **知识库（Knowledge Base）**
   - 观点树
   - 观点文章
   - 观点与划线映射

4. **图谱（Graph）**
   - 观点间关系展示

5. **发布（Publish）**
   - Markdown / HTML / PDF 导出
   - 目标渠道发布

6. **设置（Settings）**
   - 模型配置
   - 阅读偏好
   - 存储偏好

---

## 4. 总体架构

### 4.1 当前推荐架构

```text
Next.js App Router
  ├─ 页面层：书库 / 阅读器 / 知识库 / 图谱 / 发布 / 设置
  ├─ 组件层：Reader / Knowledge / Graph / Library
  └─ API Route -> Hono App

Hono API
  ├─ books
  ├─ highlights
  ├─ viewpoints
  ├─ preferences
  ├─ settings
  ├─ publish
  └─ ai

数据与存储
  ├─ MVP：JSON Repository + 本地文件
  ├─ 当前演进：PostgreSQL 持久化图书与偏好
  └─ 后续：MinIO / Redis / BullMQ
```

### 4.2 分层原则

系统需要明确分成四层：

1. **内容获取层**
   - 负责读取原始 PDF / EPUB / HTML / XML

2. **内容规整层**
   - 负责把原始文档转成“可阅读正文 + 目录 + 定位信息”

3. **阅读引擎层**
   - 负责正文渲染、定位、进度、划线

4. **业务编排层**
   - 负责知识聚合、观点树、图谱、发布、设置

其中最关键的是：**内容规整层**与**阅读引擎层**必须解耦。

---

## 5. 阅读器企业级方案

### 5.1 阅读器目标能力

阅读器不是一个页面，而是一个内核：

- 稳定打开 PDF / EPUB
- 正确渲染目录与正文
- 高亮准确落在原文片段上
- 点击目录 / 划线 / 外部引用时可稳定回跳
- 记录用户阅读进度与布局偏好
- 在内容规整升级后，已有高亮尽可能不失效

### 5.2 阅读器分层

推荐按以下模块拆分：

```text
Reader Shell
  ├─ Reader Navigator
  ├─ Reader Renderer
  ├─ Reader Locator Resolver
  ├─ Reader Highlight Layer
  ├─ Reader Progress Tracker
  └─ Reader Preferences
```

说明：

1. **Reader Shell**
   - 页面布局
   - 左目录、正文区、右侧划线区
   - 宽度拖拽与偏好记忆

2. **Reader Navigator**
   - 负责目录跳转
   - 负责从高亮回跳
   - 负责进入书籍后恢复上次阅读位置

3. **Reader Renderer**
   - 负责 PDF / EPUB / 纯文本规整内容的渲染

4. **Reader Locator Resolver**
   - 负责把外部定位信息解析为正文中具体章节、段落、偏移

5. **Reader Highlight Layer**
   - 负责原文高亮渲染、划线卡片与正文联动

6. **Reader Progress Tracker**
   - 负责滚动位置 -> 章节/段落进度

### 5.3 当前仓库已落地能力

当前仓库已经落地的阅读器关键能力：

- 禁用平滑动画，进入阅读、目录跳转、划线跳转全部直接定位
- 左目录可滚动、跟随当前阅读章节自动滚动
- 左右栏支持拖拽调宽并记忆
- 正文高亮渲染与右侧划线联动
- 右侧划线点击后直接跳回原文
- 高亮创建时记录章节与偏移信息

### 5.4 下一阶段阅读器升级路线

按企业项目优先级排序：

1. **Locator 升级**
   - 当前：`chapterHref + paragraphIndex + paraOffsetStart/End + text fallback`
   - 下一步：引入 EPUB CFI
   - 最终：统一 Locator 对象

2. **Renderer 升级**
   - 当前：规整后文本渲染
   - 下一步：EPUB 章节级真实内容渲染
   - 最终：PDF.js / EPUB.js 双内核

3. **Highlight 升级**
   - 当前：段落级文本高亮
   - 下一步：EPUB CFI / PDF text layer rect
   - 最终：原生 annotation layer

---

## 6. EPUB / HTML 解析方案

### 6.1 为什么不能继续用正则去标签

正则去标签的主要问题：

- 会丢失块级结构，正文变成一整段
- 会丢失列表、标题、表格的语义
- 会残留 `&amp;`、`&nbsp;` 等实体
- 对脏文档和嵌套结构容错极差
- 很难为后续定位模型提供稳定的结构基础

这类实现适合一次性脚本，不适合企业项目的长期核心链路。

### 6.2 当前推荐解析方案

当前推荐的 EPUB 正文规整流程：

```text
XHTML/HTML 原文
  -> parse5 解析为 DOM 树
  -> 跳过 script/style/noscript
  -> 识别 h1~h6 / p / div / section / li / pre 等块级结构
  -> 收集文本并保留段落与列表结构
  -> he 统一解码 HTML 实体
  -> 中文长段兜底切分
  -> 输出可阅读正文
```

### 6.3 当前仓库已落地

当前仓库已经完成：

1. `parse5` 结构化解析
2. `he` 实体统一解码
3. 跳过脚本和样式节点
4. 保留标题、段落、列表、换行语义
5. 中文长段兜底切分
6. 旧数据读取时再规整，避免必须重导

对应实现：

- [book-content.ts](../src/lib/book-content.ts)
- [html-entities.ts](../src/lib/html-entities.ts)
- [metadata.ts](../src/server/services/books/metadata.ts)
- [store.ts](../src/server/services/books/store.ts)

### 6.4 企业级解析规范

未来继续演进时，解析层必须满足：

1. 解析器优先
   - HTML/XHTML 用 `parse5`
   - XML/OPF/NCX 用 `fast-xml-parser`

2. 结构优先
   - 保留块级结构
   - 不允许全局压平为空格

3. 内容安全
   - 默认跳过脚本、样式、无意义控制节点

4. 容错优先
   - 脏 EPUB 允许兜底导入
   - 但必须清晰区分“结构化结果”和“兜底结果”

---

## 7. 定位与高亮模型

### 7.1 企业级定位原则

高亮回跳不能只靠文本匹配，必须采用多层 locator：

```text
L1：结构化强定位
  - EPUB：CFI / chapterHref
  - PDF：pageIndex + textLayer rects

L2：半结构定位
  - paragraphIndex
  - paraOffsetStart / paraOffsetEnd

L3：文本兜底
  - 高亮文本匹配
```

### 7.2 当前仓库定位模型

当前仓库已经采用以下优先级：

1. `chapterHref`
2. `pageIndex`
3. `paraOffsetStart / paraOffsetEnd`
4. `decodeHtmlEntities(content)` 后的文本匹配

这是一个正确的企业级方向，因为它允许后续逐步升级到 CFI，而不推翻现有模型。

### 7.3 推荐统一 Locator 对象

后续建议把高亮定位统一成：

```ts
interface HighlightLocator {
  format: "PDF" | "EPUB"
  pageIndex?: number
  chapterHref?: string
  cfiRange?: string
  paragraphIndex?: number
  paraOffsetStart?: number
  paraOffsetEnd?: number
  contentSnapshot: string
}
```

这样带来的好处：

- 渲染器、导航器、知识库引用块共用一套定位协议
- 新老定位模型可以渐进兼容
- 调试时可直接看到定位链路失败在哪一层

---

## 8. PDF 方案

### 8.1 推荐路线

PDF 方向没有必要自己造轮子，直接围绕 `PDF.js` 建：

- Worker 渲染
- TextLayer 用于选区与定位
- Annotation/Overlay Layer 用于高亮与标注

### 8.2 当前阶段建议

当前项目中 PDF 可以分两阶段：

1. **现阶段**
   - 保持规整文本阅读兜底
   - 先把“定位稳定性、进度、知识沉淀链路”做扎实

2. **下一阶段**
   - 引入 `PDF.js`
   - 生成 text layer
   - 用 `rects` 做原生高亮
   - 与当前 locator 模型对齐

---

## 9. 知识库与观点树方案

### 9.1 组织原则

知识库按“观点”组织，而不是按书籍组织。

```text
书籍 -> 划线 -> 高亮定位 -> 多观点归属 -> 观点文章 -> 图谱 / 发布
```

### 9.2 观点树要求

- 支持根级分组
- 支持根级观点
- 支持子级分组 / 子级观点
- 支持后续删除、移动、排序

### 9.3 当前实现原则

已经明确的 UI 焦点规则：

- 顶部创建按钮默认创建根级节点
- 节点内部操作才以当前节点为父级

这能避免因为“当前选中节点”导致错误挂载。

---

## 10. 开源路线与借鉴策略

### 10.1 必须参考的开源项目

1. **PDF.js**
   - 作用：PDF 解析与渲染标准实现
   - 借鉴点：text layer、annotation layer、worker

2. **epub.js**
   - 作用：Web EPUB 基础渲染与导航
   - 借鉴点：章节渲染、hooks、locations、highlights

3. **foliate-js**
   - 作用：现代 Web 阅读器内核参考
   - 借鉴点：paginator、overlayer、book interface、goTo locator

4. **Readium ts-toolkit**
   - 作用：偏标准、偏企业化的阅读工具链
   - 借鉴点：navigator、navigator-html-injectables、标准兼容

5. **parse5**
   - 作用：标准 HTML/XHTML 解析器
   - 借鉴点：结构化解析代替正则剥标签

6. **he**
   - 作用：HTML 实体解码
   - 借鉴点：统一实体处理，避免自维护字符表

### 10.2 借鉴原则

不是“把开源项目照搬进来”，而是按模块吸收：

1. **解析层**
   - 直接采用成熟库

2. **阅读器内核层**
   - 先借鉴架构和定位模型
   - 再决定是否引入现成内核

3. **业务 UI 层**
   - 保持 Lumina 自己控制

---

## 11. 当前实施状态

### 11.1 已完成

- 阅读器无动画跳转
- 目录跟随滚动
- 左右栏宽度记忆
- 正文高亮联动
- 右侧划线回跳原文
- EPUB / HTML 结构化正文规整
- HTML 实体解码
- 中文长段兜底切分
- 高亮 locator 增加 `chapterHref`
- 旧书读取时自动规整

### 11.2 未完成但已确定方向

- EPUB CFI 全链路
- PDF.js 原生渲染层
- 阅读器内核分层（navigator / renderer / overlayer）
- 高亮持久化结构进一步标准化
- 观点删除、移动、排序的完整后端语义

---

## 12. 分阶段落地计划

### Phase 1：当前基础稳定化

- 完成结构化解析替换
- 完成实体解码统一
- 完成高亮 locator 强化
- 完成阅读器跳转和高亮稳定性

### Phase 2：阅读器内核升级

- 引入 EPUB CFI
- 将阅读器拆分成 Navigator / Renderer / Locator Resolver
- 为 PDF 接入 PDF.js

### Phase 3：知识沉淀增强

- 完善观点树节点操作
- 引入高亮到观点的稳定映射协议
- 支持从文章引用块精确回跳原文

### Phase 4：企业化增强

- MinIO / Redis / 队列任务
- 批量导入与重解析任务
- 结构化监控、错误日志、灰度回退

---

## 13. 验收标准

### 13.1 阅读体验

- EPUB 正文不再压成一整段
- 常见 HTML 实体不再裸露显示
- 点击目录 / 划线 / 进入书籍可直接稳定定位
- 同一本书刷新后仍能恢复上次阅读位置

### 13.2 工程质量

- 结构化解析有独立测试
- 高亮定位有独立测试
- 构建通过
- 升级不会破坏旧书基本阅读

### 13.3 架构质量

- 阅读器定位模型可升级到 CFI
- PDF / EPUB 可分别替换渲染内核
- 解析层和业务层解耦

---

## 14. 结论

Lumina 的企业级方向已经明确：

1. **解析必须结构化**
   - `parse5 + he` 是当前正确基础

2. **定位必须多层兜底**
   - `chapterHref / pageIndex / paragraph / offset / text fallback`

3. **阅读器必须内核化**
   - Shell、Navigator、Renderer、Locator Resolver 分层

4. **业务必须以观点为核心**
   - 书籍只是来源，观点才是最终沉淀单元

这套方案不追求“大而全一次完成”，但每一步都服务于一个企业级系统该有的稳定性、可维护性与可演进性。
