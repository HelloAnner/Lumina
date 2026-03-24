# Unify PDF EPUB Reader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 PDF 与 EPUB 共用同一套阅读器交互体验，仅保留格式解析来源差异。

**Architecture:** 保留 PDF/EPUB 独立解析与入库路径，但把前端阅读器、目录、高亮、进度、侧栏与正文渲染统一到文本阅读器控制器。PDF 高亮不再依赖页面 rect，而是改为使用与 EPUB 一致的文本锚点（`pageIndex` + `paraOffsetStart/End`，PDF 不写 `chapterHref`）。

**Tech Stack:** Next.js, React, Hono, TypeScript, 本地 JSON/Postgres 双存储。

---

### Task 1: 统一阅读器控制器的测试入口

**Files:**
- Modify: `components/reader/reader-client.tsx`
- Modify: `components/reader/use-reader-controller.tsx`
- Test: `components/reader/reader-highlight-utils.test.ts`
- Test: `src/server/routes/highlights.ts`

1. 写失败测试，覆盖 PDF 文本高亮锚点解析。
2. 跑测试确认失败。
3. 最小实现，让 PDF 章节也走文本锚点。
4. 跑测试确认通过。

### Task 2: 前端统一阅读器入口

**Files:**
- Modify: `components/reader/reader-client.tsx`
- Modify: `components/reader/epub-reader-client.tsx`
- Modify/Delete usage in: `components/reader/pdf-reader-client.tsx`
- Modify: `components/reader/reader-types.ts`

1. 写失败测试或最小断言，覆盖 PDF 也走统一阅读器壳层。
2. 跑测试确认失败。
3. 最小实现，统一 shell 与 hook。
4. 跑测试确认通过。

### Task 3: 统一 PDF 高亮创建与打开逻辑

**Files:**
- Modify: `components/reader/use-reader-controller.tsx`
- Modify: `src/server/routes/highlights.ts`
- Test: `components/reader/reader-highlight-utils.test.ts`

1. 写失败测试，覆盖 PDF 高亮使用段落 offset 而非 `pdfRects`。
2. 跑测试确认失败。
3. 最小实现，创建高亮时按文本锚点写入。
4. 跑测试确认通过。

### Task 4: 清理 PDF 专属阅读器依赖并做回归验证

**Files:**
- Modify: `components/reader/pdf-reader-client.tsx`
- Modify: `components/reader/use-pdf-reader-controller.tsx`
- Verify: `node --import tsx --test ...`
- Verify: `npx tsc --noEmit`

1. 删除或降级不再走主链路的 PDF 专属阅读控制逻辑。
2. 跑全部相关测试。
3. 跑类型检查。
4. 记录差异与后续风险。
