// One-off: copy the kv table from the current database (DATABASE_URL) to the next one (DB_URL_NEXT).
// Added 13 Nov 2026 to move off the Neon project that ran out of network transfer. Off unless MIGRATE_SECRET is set.
//   ?token=…&mode=count                      rows / newest write on both sides
//   ?token=…&mode=copy[&after=<path>][&since=<ISO time>]   copy in path order; "next" in the answer = pass it as after
// A row is only overwritten when the source copy is newer (updated_at), so it is safe to run again after the switch
// to bring over what was written to the old database in between.
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const open = (url) => neon(url, { fetchOptions: { cache: "no-store" } });
const STAT = (s) => s`SELECT count(*)::int AS rows, coalesce(sum(length(data::text)), 0)::bigint AS bytes, max(updated_at) AS last FROM kv`;

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const secret = process.env.MIGRATE_SECRET;
  if (!secret || q.get("token") !== secret || !process.env.DB_URL_NEXT) return new Response("not found", { status: 404 });
  const from = open(process.env.DATABASE_URL), to = open(process.env.DB_URL_NEXT);
  try {
    if (q.get("mode") === "count") {
      const [[a], [b]] = await Promise.all([STAT(from), STAT(to)]);
      return Response.json({ from: a, to: b });
    }
    if (q.get("mode") !== "copy") return Response.json({ error: "mode=count|copy" }, { status: 400 });
    const since = q.get("since") || "1970-01-01T00:00:00Z";
    const t0 = Date.now();
    let after = q.get("after") || "", read = 0, written = 0, done = false;
    while (Date.now() - t0 < 35_000) {
      const rows = await from`SELECT path, data, ver, updated_at FROM kv WHERE path > ${after} AND updated_at > ${since}::timestamptz ORDER BY path LIMIT 25`;
      if (!rows.length) { done = true; break; }
      const w = await to`INSERT INTO kv (path, data, ver, updated_at)
        SELECT x.path, x.data, x.ver, x.updated_at FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(path text, data jsonb, ver integer, updated_at timestamptz)
        ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, ver = GREATEST(kv.ver, EXCLUDED.ver) + 1
        WHERE kv.updated_at < EXCLUDED.updated_at
        RETURNING 1`;
      read += rows.length; written += w.length;
      after = rows[rows.length - 1].path;
    }
    return Response.json({ read, written, next: done ? null : after });
  } catch (err) {
    console.error("migrate-db", err);
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
