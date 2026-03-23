# 内容解析管线专题

> 来源：`docs/2026-03-23-lumina-enterprise-system-solution.md` 的解析专项拆分  
> 日期：2026-03-23

## 1. 目标

把 PDF / EPUB / HTML 原始内容规整成：

- 可阅读正文
- 章节标题
- 目录结构
- 可用于定位的章节信息

## 2. 基本原则

- 不允许用正则作为核心 HTML 解析手段
- 结构优先于样式
- 实体解码必须统一处理
- 老数据读取时也要兜底规整

## 3. EPUB 解析流程

```text
EPUB Zip
  -> container.xml
  -> OPF / manifest / spine
  -> nav / ncx
  -> XHTML section
  -> parse5 DOM 解析
  -> 结构化正文抽取
  -> he 实体解码
  -> 中文长段兜底切分
  -> ReaderSection[]
```

## 4. 当前仓库实现

- XML：`fast-xml-parser`
- HTML/XHTML：`parse5`
- 实体解码：`he`
- 旧数据规整：读取时再跑 `normalizeStoredSectionContent`

## 5. 输出规范

每个章节至少包括：

```ts
interface ReaderSection {
  id: string
  title: string
  pageIndex: number
  content: string
  href?: string
}
```

## 6. 企业级要求

- 跳过 `script/style/noscript`
- 保留 `h1~h6 / p / div / section / li / pre` 等块级结构
- 列表不能压平成一行
- HTML 实体必须统一 decode

## 7. 演进路线

1. 当前：规整为可阅读纯文本
2. 下一步：保留 block 级结构
3. 后续：保留更强的内容文档结构，用于 EPUB 原生渲染
