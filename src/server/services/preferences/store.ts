import { ensureBookSchema, getBookPool } from "@/src/server/services/books/postgres"

export type ArticleSortBy = "lastRead" | "created"

export interface UiPreferences {
  knowledgeTreeWidth: number
  knowledgeListWidth: number
  readerTocWidth: number
  readerHighlightsWidth: number
  articleOutlineWidth: number
  articleSortBy: ArticleSortBy
}

export interface KnowledgeNoteState {
  outlineCollapsed: boolean
  scrollTop: number
  anchorHeadingId?: string
}

const DEFAULT_PREFERENCES: UiPreferences = {
  knowledgeTreeWidth: 240,
  knowledgeListWidth: 280,
  readerTocWidth: 240,
  readerHighlightsWidth: 320,
  articleOutlineWidth: 220,
  articleSortBy: "lastRead"
}

const DEFAULT_KNOWLEDGE_NOTE_STATE: KnowledgeNoteState = {
  outlineCollapsed: false,
  scrollTop: 0
}

let preferenceSchemaReady: Promise<void> | null = null

async function ensurePreferenceSchema() {
  await ensureBookSchema()
  if (!preferenceSchemaReady) {
    preferenceSchemaReady = getBookPool()
      .query(`
        CREATE TABLE IF NOT EXISTS user_ui_preferences (
          user_id TEXT PRIMARY KEY,
          knowledge_tree_width INTEGER NOT NULL DEFAULT 240,
          knowledge_list_width INTEGER NOT NULL DEFAULT 280,
          reader_toc_width INTEGER NOT NULL DEFAULT 240,
          reader_highlights_width INTEGER NOT NULL DEFAULT 320,
          article_outline_width INTEGER NOT NULL DEFAULT 220,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      .then(() =>
        getBookPool().query(`
          ALTER TABLE user_ui_preferences
          ADD COLUMN IF NOT EXISTS reader_toc_width INTEGER NOT NULL DEFAULT 240
        `)
      )
      .then(() =>
        getBookPool().query(`
          ALTER TABLE user_ui_preferences
          ADD COLUMN IF NOT EXISTS reader_highlights_width INTEGER NOT NULL DEFAULT 320
        `)
      )
      .then(() =>
        getBookPool().query(`
          ALTER TABLE user_ui_preferences
          ADD COLUMN IF NOT EXISTS article_sort_by TEXT NOT NULL DEFAULT 'lastRead'
        `)
      )
      .then(() =>
        getBookPool().query(`
          ALTER TABLE user_ui_preferences
          ADD COLUMN IF NOT EXISTS article_outline_width INTEGER NOT NULL DEFAULT 220
        `)
      )
      .then(() =>
        getBookPool().query(`
          CREATE TABLE IF NOT EXISTS user_knowledge_note_state (
            user_id TEXT NOT NULL,
            note_key TEXT NOT NULL,
            outline_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
            scroll_top INTEGER NOT NULL DEFAULT 0,
            anchor_heading_id TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (user_id, note_key)
          )
        `)
      )
      .then(() =>
        getBookPool().query(`
          ALTER TABLE user_knowledge_note_state
          ADD COLUMN IF NOT EXISTS outline_collapsed BOOLEAN NOT NULL DEFAULT FALSE
        `)
      )
      .then(() =>
        getBookPool().query(`
          ALTER TABLE user_knowledge_note_state
          ADD COLUMN IF NOT EXISTS scroll_top INTEGER NOT NULL DEFAULT 0
        `)
      )
      .then(() =>
        getBookPool().query(`
          ALTER TABLE user_knowledge_note_state
          ADD COLUMN IF NOT EXISTS anchor_heading_id TEXT
        `)
      )
      .then(() => undefined)
  }
  return preferenceSchemaReady
}

export async function getUiPreferences(userId: string): Promise<UiPreferences> {
  try {
    await ensurePreferenceSchema()
    const result = await getBookPool().query(
      `SELECT knowledge_tree_width, knowledge_list_width,
              reader_toc_width, reader_highlights_width, article_outline_width, article_sort_by
       FROM user_ui_preferences WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    const row = result.rows[0]
    if (!row) {
      return DEFAULT_PREFERENCES
    }
    return {
      knowledgeTreeWidth: row.knowledge_tree_width,
      knowledgeListWidth: row.knowledge_list_width,
      readerTocWidth: row.reader_toc_width ?? DEFAULT_PREFERENCES.readerTocWidth,
      readerHighlightsWidth:
        row.reader_highlights_width ?? DEFAULT_PREFERENCES.readerHighlightsWidth,
      articleOutlineWidth:
        row.article_outline_width ?? DEFAULT_PREFERENCES.articleOutlineWidth,
      articleSortBy: row.article_sort_by ?? DEFAULT_PREFERENCES.articleSortBy
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export async function saveUiPreferences(
  userId: string,
  preferences: Partial<UiPreferences>
): Promise<UiPreferences> {
  const current = await getUiPreferences(userId)
  const next = {
    knowledgeTreeWidth: preferences.knowledgeTreeWidth ?? current.knowledgeTreeWidth,
    knowledgeListWidth: preferences.knowledgeListWidth ?? current.knowledgeListWidth,
    readerTocWidth: preferences.readerTocWidth ?? current.readerTocWidth,
    readerHighlightsWidth:
      preferences.readerHighlightsWidth ?? current.readerHighlightsWidth,
    articleOutlineWidth:
      preferences.articleOutlineWidth ?? current.articleOutlineWidth,
    articleSortBy: preferences.articleSortBy ?? current.articleSortBy
  }
  try {
    await ensurePreferenceSchema()
    await getBookPool().query(
      `INSERT INTO user_ui_preferences
        (user_id, knowledge_tree_width, knowledge_list_width,
         reader_toc_width, reader_highlights_width, article_outline_width, article_sort_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         knowledge_tree_width = EXCLUDED.knowledge_tree_width,
         knowledge_list_width = EXCLUDED.knowledge_list_width,
         reader_toc_width = EXCLUDED.reader_toc_width,
         reader_highlights_width = EXCLUDED.reader_highlights_width,
         article_outline_width = EXCLUDED.article_outline_width,
         article_sort_by = EXCLUDED.article_sort_by,
         updated_at = NOW()`,
      [
        userId,
        next.knowledgeTreeWidth,
        next.knowledgeListWidth,
        next.readerTocWidth,
        next.readerHighlightsWidth,
        next.articleOutlineWidth,
        next.articleSortBy
      ]
    )
  } catch {
    return next
  }
  return next
}

export async function getKnowledgeNoteState(
  userId: string,
  noteKey: string
): Promise<KnowledgeNoteState> {
  if (!noteKey.trim()) {
    return DEFAULT_KNOWLEDGE_NOTE_STATE
  }
  try {
    await ensurePreferenceSchema()
    const result = await getBookPool().query(
      `SELECT outline_collapsed, scroll_top, anchor_heading_id
       FROM user_knowledge_note_state
       WHERE user_id = $1 AND note_key = $2
       LIMIT 1`,
      [userId, noteKey]
    )
    const row = result.rows[0]
    if (!row) {
      return DEFAULT_KNOWLEDGE_NOTE_STATE
    }
    return {
      outlineCollapsed: Boolean(row.outline_collapsed),
      scrollTop: Math.max(0, Number(row.scroll_top ?? 0)),
      anchorHeadingId: row.anchor_heading_id ?? undefined
    }
  } catch {
    return DEFAULT_KNOWLEDGE_NOTE_STATE
  }
}

export async function saveKnowledgeNoteState(
  userId: string,
  noteKey: string,
  state: Partial<KnowledgeNoteState>
): Promise<KnowledgeNoteState> {
  const current = await getKnowledgeNoteState(userId, noteKey)
  const next = {
    outlineCollapsed: state.outlineCollapsed ?? current.outlineCollapsed,
    scrollTop: Math.max(0, Math.round(state.scrollTop ?? current.scrollTop)),
    anchorHeadingId: normalizeHeadingId(
      state.anchorHeadingId ?? current.anchorHeadingId
    )
  }
  try {
    await ensurePreferenceSchema()
    await getBookPool().query(
      `INSERT INTO user_knowledge_note_state
        (user_id, note_key, outline_collapsed, scroll_top, anchor_heading_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, note_key)
       DO UPDATE SET
         outline_collapsed = EXCLUDED.outline_collapsed,
         scroll_top = EXCLUDED.scroll_top,
         anchor_heading_id = EXCLUDED.anchor_heading_id,
         updated_at = NOW()`,
      [
        userId,
        noteKey,
        next.outlineCollapsed,
        next.scrollTop,
        next.anchorHeadingId ?? null
      ]
    )
  } catch {
    return next
  }
  return next
}

function normalizeHeadingId(value?: string): string | undefined {
  const headingId = value?.trim()
  return headingId ? headingId : undefined
}
