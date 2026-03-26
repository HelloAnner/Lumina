# Article Published At Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为文章阅读页补齐发布时间展示，并在文章解析链路中解析与持久化发布时间。

**Architecture:** 先在解析层统一抽取网页发布时间并标准化，再让手动导入与重新抓取复用该字段，最后在阅读器标题区域按轻量样式展示。实现保持在现有 `ScoutArticle` 数据模型内完成，不新增独立表或额外接口。

**Tech Stack:** Next.js 14、TypeScript、node:test、现有文章仓储与阅读器组件

---

### Task 1: 锁定解析行为

**Files:**
- Modify: `src/server/services/scout/content-extractor.test.ts`
- Modify: `src/server/services/articles/manual-import.test.ts`

**Step 1:** 写出网页元数据发布时间解析失败用例  
**Step 2:** 写出手动导入持久化发布时间失败用例  
**Step 3:** 运行局部测试确认失败

### Task 2: 补齐后端链路

**Files:**
- Modify: `src/server/services/scout/content-extractor.ts`
- Modify: `src/server/services/articles/manual-import.ts`
- Modify: `src/server/routes/articles.ts`

**Step 1:** 为提取结果补 `publishedAt`  
**Step 2:** 在导入与重抓取时写入 `ScoutArticle.publishedAt`  
**Step 3:** 运行局部测试确认通过

### Task 3: 补齐前端展示

**Files:**
- Create: `components/articles/article-published-at.ts`
- Create: `components/articles/article-published-at.test.ts`
- Modify: `components/articles/article-reader-client.tsx`
- Modify: `ui/ui.pen`

**Step 1:** 先写发布时间文案格式化测试  
**Step 2:** 最小实现格式化函数  
**Step 3:** 在阅读页标题旁接入显示  
**Step 4:** 同步更新 `ui/ui.pen`
