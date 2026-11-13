// Server-only key/value store. Documents live in Postgres (Neon project pakpak-db-2) as JSON rows keyed by path,
// e.g. "members/U123.json" or "meta/roster.json". The old Vercel Blob store (suspended on the Hobby plan
// until 27 Nov 2026) keeps the earlier data; lib/legacy.js merges it back when it unlocks.
import { neon } from "@neondatabase/serverless";

// Schema (already created in production; run once by hand on a fresh database):
//   CREATE TABLE IF NOT EXISTS kv (path text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), ver integer NOT NULL DEFAULT 0);
// It used to run on every cold start: two extra round trips, and the ALTER TABLE takes a table lock that queues behind reads.
let sql;
function db() {
  // no-store: Next.js would otherwise cache these fetches inside route handlers and serve stale rows
  // DB_URL_NEXT: Neon project pakpak-db-2 (since 13 Nov 2026, when pakpak-db ran out of its monthly network transfer).
  // DATABASE_URL is still the old project, managed by the Vercel integration; removing DB_URL_NEXT goes back to it.
  if (!sql) sql = neon(process.env.DB_URL_NEXT || process.env.DATABASE_URL, { fetchOptions: { cache: "no-store" } });
  return Promise.resolve(sql);
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

// Version-gated cache per function instance, for documents that are large and change rarely
// (the shared catalog ~1 MB+, the sales history). After `ttl` it asks Postgres for the row's `ver` only;
// the document itself travels again only when the version moved. Polling the whole document every minute
// used up Neon's 5 GB/month network transfer in 13 days (Nov 2026).
// ttl 0 = check the version on every call (always fresh, still a few bytes when unchanged).
// Callers must treat the result as read-only: it is shared between requests.
const docs = new Map();
const DOCS_MAX = 40;
export async function readCached(path, key, ttl = 60_000) {
  const k = path + "\n" + (key || "");
  const c = docs.get(k);
  if (c?.has && ttl && Date.now() - c.at < ttl) return c.data;
  if (c?.pending) return c.pending;
  const e = c || { has: false, ver: -1, data: null, at: 0, pending: null };
  docs.delete(k); docs.set(k, e); // newest last
  for (const old of docs.keys()) { if (docs.size <= DOCS_MAX) break; if (old !== k) docs.delete(old); }
  e.pending = (async () => {
    const s = await db();
    const known = e.has ? e.ver : -1;
    const rows = key
      ? await s`SELECT ver, ver <> ${known} AS changed, CASE WHEN ver <> ${known} THEN data -> ${key} END AS data FROM kv WHERE path = ${path}`
      : await s`SELECT ver, ver <> ${known} AS changed, CASE WHEN ver <> ${known} THEN data END AS data FROM kv WHERE path = ${path}`;
    if (!rows.length) { e.ver = -1; e.data = null; }
    else if (rows[0].changed || !e.has) { e.ver = rows[0].ver; e.data = rows[0].data; }
    e.has = true; e.at = Date.now(); e.pending = null;
    return e.data;
  })().catch((err) => {
    e.pending = null;
    if (e.has) { e.at = Date.now() - Math.max(0, ttl - 10_000); return e.data; } // database trouble: keep serving the last copy, retry in ~10s
    docs.delete(k);
    throw err;
  });
  return e.pending;
}

// Shallow merge into a document inside Postgres (same result as { ...cur, ...patch }) without pulling it out first.
// drop: top-level keys to remove. init: extra fields when the document does not exist yet.
// touch: false leaves `ver` alone, for small status fields that must not make readCached() reload the document.
// Returns the document's `updatedAt` field after the write.
export async function patchJSON(path, patch, { init = {}, drop = [], touch = true } = {}) {
  const s = await db();
  const first = JSON.stringify({ ...init, ...patch }), p = JSON.stringify(patch);
  const rows = touch
    ? await s`INSERT INTO kv (path, data, updated_at) VALUES (${path}, ${first}::jsonb, now())
              ON CONFLICT (path) DO UPDATE SET data = (kv.data - ${drop}::text[]) || ${p}::jsonb, updated_at = now(), ver = kv.ver + 1
              RETURNING data -> 'updatedAt' AS u`
    : await s`INSERT INTO kv (path, data, updated_at) VALUES (${path}, ${first}::jsonb, now())
              ON CONFLICT (path) DO UPDATE SET data = (kv.data - ${drop}::text[]) || ${p}::jsonb, updated_at = now()
              RETURNING data -> 'updatedAt' AS u`;
  return rows[0]?.u ?? null;
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
// keys: send only these top-level fields of each document (much less data for list views).
export async function readMany(paths, keys) {
  if (!paths.length) return [];
  const s = await db();
  const out = new Map();
  for (let i = 0; i < paths.length; i += 500) {
    const part = paths.slice(i, i + 500);
    const rows = keys
      ? await s`SELECT path, (SELECT COALESCE(jsonb_object_agg(k, data -> k), '{}'::jsonb) FROM unnest(${keys}::text[]) AS k WHERE data ? k) AS data FROM kv WHERE path = ANY(${part})`
      : await s`SELECT path, data FROM kv WHERE path = ANY(${part})`;
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
