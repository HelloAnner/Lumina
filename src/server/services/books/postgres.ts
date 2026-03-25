import { Pool } from "pg"

declare global {
  var luminaPgPool: Pool | undefined
}

let schemaReady: Promise<void> | null = null

function getPool() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://lumina:lumina@localhost:25432/lumina"

  if (!globalThis.luminaPgPool) {
    globalThis.luminaPgPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000
    })
  }
  return globalThis.luminaPgPool
}

export async function ensureBookSchema() {
  if (!schemaReady) {
    schemaReady = getPool().query(`
      CREATE TABLE IF NOT EXISTS app_books (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        format TEXT NOT NULL,
        file_path TEXT NOT NULL,
        cover_path TEXT,
        cover_variant INTEGER DEFAULT 0,
        total_pages INTEGER,
        read_progress REAL DEFAULT 0,
        last_read_at TIMESTAMPTZ,
        tags JSONB DEFAULT '[]'::jsonb,
        status TEXT NOT NULL,
        synopsis TEXT,
        toc JSONB DEFAULT '[]'::jsonb,
        content JSONB DEFAULT '[]'::jsonb,
        object_bucket TEXT,
        object_key TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_app_books_user_id ON app_books(user_id);
    `).then(async () => {
      await getPool().query(`
        ALTER TABLE app_books ADD COLUMN IF NOT EXISTS cover_variant INTEGER DEFAULT 0;
      `).catch(() => {})
    })
  }
  return schemaReady
}

export function getBookPool() {
  return getPool()
}
