// Server-only key/value store. Documents live in Postgres (Neon) as JSON rows keyed by path,
// e.g. "members/U123.json" or "meta/roster.json". The old Vercel Blob store (suspended on the Hobby plan
// until 27 Nov 2026) keeps the earlier data; lib/legacy.js merges it back when it unlocks.
import { neon } from "@neondatabase/serverless";

let sql, ready;
function db() {
  if (!sql) sql = neon(process.env.DATABASE_URL);
  if (!ready) ready = sql`CREATE TABLE IF NOT EXISTS kv (path text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  return ready.then(() => sql);
}

// null only when the document does not exist; database errors are thrown, never read as "missing".
export async function readJSON(path) {
  const s = await db();
  const rows = await s`SELECT data FROM kv WHERE path = ${path}`;
  return rows.length ? rows[0].data : null;
}

export async function writeJSON(path, data) {
  const s = await db();
  await s`INSERT INTO kv (path, data, updated_at) VALUES (${path}, ${JSON.stringify(data)}::jsonb, now())
          ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
}

export async function remove(path) {
  try { const s = await db(); await s`DELETE FROM kv WHERE path = ${path}`; } catch {}
}
