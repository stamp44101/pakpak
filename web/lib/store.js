// Server-only key/value store. Documents live in Postgres (Neon) as JSON rows keyed by path,
// e.g. "members/U123.json" or "meta/roster.json". The old Vercel Blob store (suspended on the Hobby plan
// until 27 Nov 2026) keeps the earlier data; lib/legacy.js merges it back when it unlocks.
import { neon } from "@neondatabase/serverless";

let sql, ready;
function db() {
  // no-store: Next.js would otherwise cache these fetches inside route handlers and serve stale rows
  if (!sql) sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: "no-store" } });
  if (!ready) ready = sql`CREATE TABLE IF NOT EXISTS kv (path text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`
    .then(() => sql`ALTER TABLE kv ADD COLUMN IF NOT EXISTS ver integer NOT NULL DEFAULT 0`);
  return ready.then(() => sql);
}

// null only when the document does not exist; database errors are thrown, never read as "missing".
// key: read only one top-level field of the document (less data over the wire).
export async function readJSON(path, key) {
  const s = await db();
  const rows = key
    ? await s`SELECT data -> ${key} AS data FROM kv WHERE path = ${path}`
    : await s`SELECT data FROM kv WHERE path = ${path}`;
  return rows.length ? rows[0].data : null;
}

export async function writeJSON(path, data) {
  const s = await db();
  await s`INSERT INTO kv (path, data, updated_at) VALUES (${path}, ${JSON.stringify(data)}::jsonb, now())
          ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), ver = kv.ver + 1`;
}

export async function remove(path) {
  try { const s = await db(); await s`DELETE FROM kv WHERE path = ${path}`; } catch {}
}

// Read-modify-write without lost updates: retries when another request changed the document in between.
// fn gets the current document (or init()) and returns the new one; it may run more than once.
export async function updateJSON(path, fn, init = () => ({})) {
  const s = await db();
  for (let i = 0; i < 10; i++) {
    const rows = await s`SELECT data, ver FROM kv WHERE path = ${path}`;
    const cur = rows.length ? rows[0].data : init();
    const next = await fn(cur);
    const ok = rows.length
      ? await s`UPDATE kv SET data = ${JSON.stringify(next)}::jsonb, updated_at = now(), ver = ver + 1 WHERE path = ${path} AND ver = ${rows[0].ver} RETURNING 1`
      : await s`INSERT INTO kv (path, data, updated_at) VALUES (${path}, ${JSON.stringify(next)}::jsonb, now()) ON CONFLICT (path) DO NOTHING RETURNING 1`;
    if (ok.length) return next;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 120));
  }
  throw new Error("updateJSON: too much contention on " + path);
}

// Many documents in one query (in input order, missing ones skipped). One round trip instead of one per path.
export async function readMany(paths) {
  if (!paths.length) return [];
  const s = await db();
  const out = new Map();
  for (let i = 0; i < paths.length; i += 500) {
    const rows = await s`SELECT path, data FROM kv WHERE path = ANY(${paths.slice(i, i + 500)})`;
    for (const r of rows) out.set(r.path, r.data);
  }
  return paths.map((p) => out.get(p)).filter(Boolean);
}

// Paths under a prefix, e.g. listPaths("members/") → ["members/U1.json", ...].
export async function listPaths(prefix) {
  const s = await db();
  const rows = await s`SELECT path FROM kv WHERE path LIKE ${prefix + "%"}`;
  return rows.map((r) => r.path);
}

// Every row, for the daily backup (app/api/admin/backup). A few MB today; revisit if kv grows past ~50 MB.
export async function dumpAll() {
  const s = await db();
  return s`SELECT path, data, ver, updated_at FROM kv ORDER BY path`;
}
