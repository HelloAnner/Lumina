# Note Editor Performance Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the knowledge note editor hot path so editing is transaction-driven, locally responsive, and no longer causes full-document rebuilds or page-level rerenders.

**Architecture:** Keep TipTap as the editor core and `NoteBlock[]` as the persistence shape, but move live editing state into the editor, expose only throttled snapshots upward, and route block operations through ProseMirror transactions instead of `setContent` rebuilds. Preserve current UI and feature surface.

**Tech Stack:** Next.js 14, React 18, TipTap 2, node:test, TypeScript

---

### Task 1: Lock the regression surface with tests

**Files:**
- Modify: `components/knowledge/note-editor-doc.test.ts`
- Create: `components/knowledge/note-editor-state.test.ts`

**Step 1: Write failing tests for transaction-oriented block operations**

- Add tests that describe insert, duplicate, move, delete, and transform behavior without requiring full block-array rebuild helpers.
- Add tests for utility functions that derive the current block and slash query from a minimal document shape.

**Step 2: Run the targeted tests to confirm failure**

Run: `npx tsx --test components/knowledge/note-editor-doc.test.ts components/knowledge/note-editor-state.test.ts`

**Step 3: Implement the minimal editor utility layer**

- Create pure helpers for reading block ids, slash query, heading positions cache inputs, and block stats from editor JSON/content.

**Step 4: Re-run the targeted tests**

Run: `npx tsx --test components/knowledge/note-editor-doc.test.ts components/knowledge/note-editor-state.test.ts`

### Task 2: Replace full-document command paths inside `NoteEditor`

**Files:**
- Modify: `components/knowledge/note-editor.tsx`
- Modify: `components/knowledge/note-editor-doc.ts`

**Step 1: Write failing tests for block operation utilities if still missing**

- Cover insert-after, transform-current-block, duplicate-current-block, move-by-offset, and delete-current-block based on document-level operations.

**Step 2: Run the focused tests and verify failure**

Run: `npx tsx --test components/knowledge/note-editor-doc.test.ts`

**Step 3: Implement transaction-first command plumbing**

- Stop converting the whole editor document into `NoteBlock[]` for local editing commands.
- Restrict `setContent` usage to external content replacement only.
- Keep parent snapshot updates debounced and derived from editor state after transactions.

**Step 4: Re-run focused tests**

Run: `npx tsx --test components/knowledge/note-editor-doc.test.ts components/knowledge/note-editor-state.test.ts`

### Task 3: Remove legacy editor state from `KnowledgeClient`

**Files:**
- Modify: `components/knowledge/knowledge-client.tsx`
- Modify: `components/knowledge/right-sidebar.tsx`
- Modify: `components/knowledge/chat-sidebar.tsx`

**Step 1: Write a failing view-state regression test if coverage is missing**

- Capture the expectation that page-level loading and tab switching do not require legacy block editing timers or stale edit refs.

**Step 2: Run the relevant tests and confirm failure**

Run: `npx tsx --test components/knowledge/knowledge-view-state.test.ts`

**Step 3: Remove dead editor state paths**

- Delete unused legacy block editing callbacks, refs, timers, and focus state.
- Keep one path for fetching blocks, one path for receiving debounced editor snapshots, and one path for external updates from sidebars.
- Narrow the props passed to the right sidebar so inactive panels do not track every keystroke.

**Step 4: Re-run the relevant tests**

Run: `npx tsx --test components/knowledge/knowledge-view-state.test.ts`

### Task 4: Reduce interaction-path DOM churn

**Files:**
- Modify: `components/knowledge/note-editor.tsx`
- Modify: `components/knowledge/note-outline-utils.ts`

**Step 1: Write failing tests for outline and active-heading helpers if needed**

- Add tests around heading position resolution inputs and active heading selection behavior.

**Step 2: Run the helper tests to confirm failure**

Run: `npx tsx --test components/knowledge/note-outline-utils.test.ts`

**Step 3: Implement low-churn DOM coordination**

- Cache heading node lookups per editor content revision.
- Throttle hover/gutter recalculation with `requestAnimationFrame`.
- Avoid repeated whole-editor scans when selected or annotated block ids change.

**Step 4: Re-run helper tests**

Run: `npx tsx --test components/knowledge/note-outline-utils.test.ts`

### Task 5: Verify the full editor slice

**Files:**
- Modify: `docs/knowledge-base/editor-upgrade.md`
- Modify: `docs/knowledge-base/editor-performance-refactor.md`

**Step 1: Run editor-focused tests**

Run: `npx tsx --test components/knowledge/*.test.ts src/lib/keyboard-shortcuts.test.ts`

**Step 2: Run repository verification**

Run: `npm run verify`

**Step 3: Run a production build**

Run: `npm run build`

**Step 4: Update docs to match shipped architecture**

- Remove stale statements that still describe the pre-TipTap editor.
- Keep `editor-performance-refactor.md` aligned with the implementation result.
