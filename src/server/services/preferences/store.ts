import { ensureBookSchema, getBookPool } from "@/src/server/services/books/postgres"

export type ArticleSortBy = "lastRead" | "created"

export interface UiPreferences {
  knowledgeTreeWidth: number
  knowledgeListWidth: number
  readerTocWidth: number
  readerHighlightsWidth: number
  articleSortBy: ArticleSortBy
}

const DEFAULT_PREFERENCES: UiPreferences = {
  knowledgeTreeWidth: 240,
  knowledgeListWidth: 280,
  readerTocWidth: 240,
  readerHighlightsWidth: 320,
  articleSortBy: "lastRead"
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
      .then(() => undefined)
  }
  return preferenceSchemaReady
}

export async function getUiPreferences(userId: string): Promise<UiPreferences> {
  try {
    await ensurePreferenceSchema()
    const result = await getBookPool().query(
      `SELECT knowledge_tree_width, knowledge_list_width,
              reader_toc_width, reader_highlights_width, article_sort_by
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
    articleSortBy: preferences.articleSortBy ?? current.articleSortBy
  }
  try {
    await ensurePreferenceSchema()
    await getBookPool().query(
      `INSERT INTO user_ui_preferences
        (user_id, knowledge_tree_width, knowledge_list_width,
         reader_toc_width, reader_highlights_width, article_sort_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         knowledge_tree_width = EXCLUDED.knowledge_tree_width,
         knowledge_list_width = EXCLUDED.knowledge_list_width,
         reader_toc_width = EXCLUDED.reader_toc_width,
         reader_highlights_width = EXCLUDED.reader_highlights_width,
         article_sort_by = EXCLUDED.article_sort_by,
         updated_at = NOW()`,
      [
        userId,
        next.knowledgeTreeWidth,
        next.knowledgeListWidth,
        next.readerTocWidth,
        next.readerHighlightsWidth,
        next.articleSortBy
      ]
    )
  } catch {
    return next
  }
  return next
}
