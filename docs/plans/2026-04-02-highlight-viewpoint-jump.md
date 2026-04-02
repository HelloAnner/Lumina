# Highlight Viewpoint Jump Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users click an existing reader highlight, inspect which viewpoint blocks consumed it, and jump into Knowledge with automatic block-level positioning.

**Architecture:** Add a highlight-reference lookup API on top of existing `highlightViewpoints` plus persisted `articleBlocks`, then thread URL-level jump state from reader to knowledge page. Reuse existing `highlightId` block attributes and note-editor block selection/scroll behavior instead of creating a parallel navigation system.

**Tech Stack:** Hono routes, local repository/store layer, React client components, TipTap note editor, URL query state.

---

### Task 1: Lock the URL jump contract

**Files:**
- Modify: `components/knowledge/knowledge-url-state.ts`
- Modify: `components/knowledge/knowledge-url-state.test.ts`

**Step 1: Write failing tests**

- Add tests for:
  - `buildKnowledgeSearch` writes `block` and `highlight`
  - `readKnowledgeSelection` reads `block` and `highlight`
  - switching to imported note clears jump params

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test components/knowledge/knowledge-url-state.test.ts`

**Step 3: Implement minimal URL-state extension**

- Extend selection shape with `blockId` and `highlightId`
- Preserve current semantics for `viewpoint` / `importedNote`

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test components/knowledge/knowledge-url-state.test.ts`

### Task 2: Add repository lookup for highlight references

**Files:**
- Modify: `src/server/repositories/index.ts`
- Modify: `src/server/repositories/index.test.ts`

**Step 1: Write failing repository test**

- Seeded highlight should return viewpoint title + block id + snippet

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/server/repositories/index.test.ts`

**Step 3: Implement minimal repository helper**

- Add `getHighlight`
- Add `listHighlightReferences`

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/server/repositories/index.test.ts`

### Task 3: Expose the API route

**Files:**
- Modify: `src/server/routes/highlights.ts`
- Create: `src/server/routes/highlights.references.test.ts`

**Step 1: Write failing route test**

- `GET /api/highlights/:id/references` returns highlight + reference list

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/server/routes/highlights.references.test.ts`

**Step 3: Implement route**

- Add authenticated `GET /:id/references`
- Return 404 when highlight missing

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/server/routes/highlights.references.test.ts`

### Task 4: Add knowledge-side jump targeting

**Files:**
- Modify: `components/knowledge/knowledge-client.tsx`
- Modify: `components/knowledge/note-editor.tsx`

**Step 1: Write failing UI-state tests if feasible; otherwise lock behavior in existing pure tests**

- Prefer pure-function coverage in URL-state tests
- Add minimal editor helper if needed for target resolution

**Step 2: Implement**

- Parse `block` / `highlight` from URL selection
- After blocks load, resolve target block
- Scroll to target block and apply temporary visual hint

**Step 3: Verify**

- Run targeted tests
- Manual smoke via `make dev`

### Task 5: Add reader modal and jump actions

**Files:**
- Modify: `components/reader/reader-highlight-panel.tsx`
- Modify: `components/reader/use-reader-controller.tsx`
- Modify: `components/articles/use-article-reader-controller.tsx`
- Create or modify a small shared helper/component as needed

**Step 1: Implement modal state + fetch**

- Card click opens modal
- Modal requests `/api/highlights/:id/references`

**Step 2: Implement jump CTA**

- Build knowledge URL with `viewpoint`, `block`, `highlight`
- Open knowledge route directly

**Step 3: Verify**

- Manual smoke in both book reader and article reader

### Task 6: Final verification

**Files:**
- Modify: `docs/reader/highlight-viewpoint-jump.md` if implementation details drift

**Step 1: Run targeted verification**

Run:
- `node --import tsx --test components/knowledge/knowledge-url-state.test.ts`
- `node --import tsx --test src/server/repositories/index.test.ts`
- `node --import tsx --test src/server/routes/highlights.references.test.ts`

**Step 2: Run app smoke**

Run: `make dev`

**Step 3: Confirm manual path**

- Open reader
- Click existing highlight card
- Open modal
- Click jump
- Knowledge auto-opens and positions target block
