# Translation Accuracy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提升阅读翻译链路的结构准确性、目标语言一致性与并发稳定性，避免错段、丢段、重复翻译。

**Architecture:** 将模型请求与响应解析从 `service.ts` 中拆出，补充分批翻译、严格索引校验与目标语言透传；在服务层增加同章节并发去重，保持缓存与已有接口不变。

**Tech Stack:** TypeScript、Node Test、Hono、Next.js

---

### Task 1: 补齐翻译请求层测试

**Files:**
- Create: `src/server/services/translation/request.test.ts`
- Modify: `src/server/services/translation/service.test.ts`

**Step 1: 写失败测试**

- 验证请求体会透传 `targetLanguage`
- 验证长段落会按批次拆分
- 验证批次结果会按原始顺序回拼
- 验证同章节并发请求只触发一次模型调用

**Step 2: 运行失败测试**

Run: `npx tsx --test src/server/services/translation/request.test.ts src/server/services/translation/service.test.ts`

Expected: 因缺少新请求模块和并发去重逻辑而失败

### Task 2: 实现翻译请求层

**Files:**
- Create: `src/server/services/translation/request.ts`
- Modify: `src/server/services/translation/service.ts`

**Step 1: 抽离请求构建与响应解析**

- 抽出模型请求构建
- 让 `targetLanguage` 真正参与 prompt 和 payload
- 将返回结构改为带 `index` 的严格映射

**Step 2: 实现分批翻译**

- 基于段落数与字符数拆批
- 逐批请求并按顺序回拼结果
- 对空译文、缺失索引、重复索引做校验

**Step 3: 实现并发去重**

- 以 `sectionId + sourceHash + targetLanguage` 建立进行中任务表
- 同章节并发请求复用同一个 Promise

### Task 3: 验证与收尾

**Files:**
- Modify: `src/server/services/translation/service.test.ts`
- Modify: `src/server/services/translation/request.test.ts`

**Step 1: 跑定向测试**

Run: `npx tsx --test src/server/services/translation/request.test.ts src/server/services/translation/service.test.ts`

Expected: 全部通过

**Step 2: 跑回归测试**

Run: `npx tsx --test components/reader/reader-translation-utils.test.ts src/server/repositories/index.test.ts`

Expected: 全部通过
