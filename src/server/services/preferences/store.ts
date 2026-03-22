import { ensureBookSchema, getBookPool } from "@/src/server/services/books/postgres"

export interface UiPreferences {
  knowledgeTreeWidth: number
  knowledgeListWidth: number
}

const DEFAULT_PREFERENCES: UiPreferences = {
  knowledgeTreeWidth: 240,
  knowledgeListWidth: 280
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
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      .then(() => undefined)
  }
  return preferenceSchemaReady
}

export async function getUiPreferences(userId: string): Promise<UiPreferences> {
  try {
    await ensurePreferenceSchema()
    const result = await getBookPool().query(
      `SELECT knowledge_tree_width, knowledge_list_width
       FROM user_ui_preferences WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    const row = result.rows[0]
    if (!row) {
      return DEFAULT_PREFERENCES
    }
    return {
      knowledgeTreeWidth: row.knowledge_tree_width,
      knowledgeListWidth: row.knowledge_list_width
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
    knowledgeListWidth: preferences.knowledgeListWidth ?? current.knowledgeListWidth
  }
  try {
    await ensurePreferenceSchema()
    await getBookPool().query(
      `INSERT INTO user_ui_preferences
        (user_id, knowledge_tree_width, knowledge_list_width, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         knowledge_tree_width = EXCLUDED.knowledge_tree_width,
         knowledge_list_width = EXCLUDED.knowledge_list_width,
         updated_at = NOW()`,
      [userId, next.knowledgeTreeWidth, next.knowledgeListWidth]
    )
  } catch {
    return next
  }
  return next
}
