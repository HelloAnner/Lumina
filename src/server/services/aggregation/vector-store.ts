/**
 * 向量存储层
 * 基于 pgvector 实现划线和主题的向量存储与相似度搜索
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/24
 */
import { getBookPool } from "@/src/server/services/books/postgres"

let schemaReady: Promise<void> | null = null

/**
 * 初始化向量表结构
 * 使用 1536 维度（兼容 OpenAI text-embedding-3-small 等主流模型）
 */
export async function ensureVectorSchema() {
  if (!schemaReady) {
    const pool = getBookPool()
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS highlight_vectors (
        highlight_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hv_user ON highlight_vectors(user_id);

      CREATE TABLE IF NOT EXISTS viewpoint_vectors (
        viewpoint_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        embedding vector(1536),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_vv_user ON viewpoint_vectors(user_id);
    `).then(() => undefined)
  }
  return schemaReady
}

/**
 * 存储划线的向量
 */
export async function upsertHighlightVector(
  highlightId: string,
  userId: string,
  embedding: number[]
) {
  await ensureVectorSchema()
  const pool = getBookPool()
  await pool.query(
    `INSERT INTO highlight_vectors (highlight_id, user_id, embedding)
     VALUES ($1, $2, $3::vector)
     ON CONFLICT (highlight_id) DO UPDATE SET embedding = $3::vector`,
    [highlightId, userId, JSON.stringify(embedding)]
  )
}

/**
 * 存储主题的向量
 */
export async function upsertViewpointVector(
  viewpointId: string,
  userId: string,
  embedding: number[]
) {
  await ensureVectorSchema()
  const pool = getBookPool()
  await pool.query(
    `INSERT INTO viewpoint_vectors (viewpoint_id, user_id, embedding, updated_at)
     VALUES ($1, $2, $3::vector, NOW())
     ON CONFLICT (viewpoint_id) DO UPDATE SET embedding = $3::vector, updated_at = NOW()`,
    [viewpointId, userId, JSON.stringify(embedding)]
  )
}

/**
 * 搜索与划线向量最相似的主题
 * 返回相似度大于阈值的所有主题，按相似度降序
 */
export async function searchSimilarViewpoints(
  userId: string,
  highlightEmbedding: number[],
  threshold: number = 0.65,
  limit: number = 10
): Promise<{ viewpointId: string; similarity: number }[]> {
  await ensureVectorSchema()
  const pool = getBookPool()
  // 余弦相似度 = 1 - 余弦距离
  const result = await pool.query(
    `SELECT viewpoint_id,
            1 - (embedding <=> $1::vector) AS similarity
     FROM viewpoint_vectors
     WHERE user_id = $2
       AND 1 - (embedding <=> $1::vector) > $3
     ORDER BY similarity DESC
     LIMIT $4`,
    [JSON.stringify(highlightEmbedding), userId, threshold, limit]
  )
  return result.rows.map((row: { viewpoint_id: string; similarity: number }) => ({
    viewpointId: row.viewpoint_id,
    similarity: Number(row.similarity)
  }))
}

/**
 * 删除划线向量（划线被删除时调用）
 */
export async function deleteHighlightVector(highlightId: string) {
  await ensureVectorSchema()
  const pool = getBookPool()
  await pool.query("DELETE FROM highlight_vectors WHERE highlight_id = $1", [highlightId])
}

/**
 * 删除主题向量（主题被删除时调用）
 */
export async function deleteViewpointVector(viewpointId: string) {
  await ensureVectorSchema()
  const pool = getBookPool()
  await pool.query("DELETE FROM viewpoint_vectors WHERE viewpoint_id = $1", [viewpointId])
}
