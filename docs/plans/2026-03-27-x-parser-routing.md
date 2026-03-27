# X Parser Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为文章解析链路增加按 URL 选择子解析器的能力，并新增专门面向 `x.com` / `twitter.com` 状态页的解析器，只保留正文与图片。

**Architecture:** 保留现有 Readability 解析器作为通用兜底，在其外层增加解析器路由与共享底座模块。共享底座负责抓取页面、HTML 转 `ArticleSection[]`、图片地址解析和文本规整；`x` 解析器优先读取页面中的结构化状态数据，输出干净的推文正文与图片，再由手动导入、重新抓取和 Scout 抓取统一复用新入口。

**Tech Stack:** Next.js 14、TypeScript、node:test、linkedom、parse5、现有文章导入与抓取服务

---

### Task 1: 锁定解析行为

**Files:**
- Modify: `src/server/services/scout/content-extractor.test.ts`
- Modify: `src/server/services/articles/manual-import.test.ts`

**Step 1:** 写出 `x.com` 状态页只保留正文和图片的失败用例  
**Step 2:** 写出解析器路由层按 URL 选择 `x` 解析器的失败用例  
**Step 3:** 运行局部测试确认当前实现失败

### Task 2: 抽取解析底座

**Files:**
- Create: `src/server/services/scout/content-extractor/base.ts`
- Modify: `src/server/services/scout/content-extractor.ts`

**Step 1:** 抽出抓页面、结果类型、HTML 转 section、图片解析等公共能力  
**Step 2:** 让现有通用解析器改为复用底座  
**Step 3:** 保持原有通用测试仍可通过

### Task 3: 增加路由与 X 解析器

**Files:**
- Create: `src/server/services/scout/content-extractor/router.ts`
- Create: `src/server/services/scout/content-extractor/generic.ts`
- Create: `src/server/services/scout/content-extractor/x.ts`
- Modify: `src/server/services/scout/content-extractor.ts`

**Step 1:** 新增 host/path 匹配规则  
**Step 2:** 实现 `x` 页面结构化提取与正文/图片过滤  
**Step 3:** 让统一入口对外仍暴露 `fetchAndExtract` / `extractFromHtml`

### Task 4: 回填业务入口与文档

**Files:**
- Modify: `src/server/routes/articles.ts`
- Modify: `src/server/services/scout/pipeline.ts`
- Modify: `docs/articles/manual-link-import.md`
- Create: `docs/articles/url-routed-parsers.md`

**Step 1:** 让重新抓取与抓取管线复用解析器路由入口  
**Step 2:** 更新手动导入文档，不再描述为“仅 Readability”  
**Step 3:** 新增解析器路由文档，说明 `x` 专用策略与兜底规则

### Task 5: 验证

**Files:**
- Test: `src/server/services/scout/content-extractor.test.ts`
- Test: `src/server/services/articles/manual-import.test.ts`

**Step 1:** 跑新增失败测试并确认红灯  
**Step 2:** 实现后跑局部测试确认绿灯  
**Step 3:** 视结果补齐回归验证并记录剩余风险
