// One-time: copy everything from the old Vercel Blob store into Postgres once the store is unlocked
// (Pro plan, or after the Hobby limit resets on 27 Nov 2026). Owner only. Safe to run more than once.
// Members: the old record wins (plan, Early Access, payments); state: whichever is newer; roster: merged.
import { list, get } from "@vercel/blob";
import { requireMember, roster } from "../../../../lib/auth";
import { readJSON, writeJSON, updateJSON } from "../../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function readBlob(pathname) {
  const r = await get(pathname, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function POST(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  if ((await roster()).admins[0] !== member.id) return Response.json({ error: "เจ้าของเท่านั้น" }, { status: 403 });
  const out = { members: 0, states: 0, other: 0, skipped: 0, failed: [] };
  const prefix = new URL(req.url).searchParams.get("prefix") || undefined;
  let cursor;
  do {
    const page = await list({ cursor, limit: 1000, prefix });
    const work = page.blobs.map((b) => b.pathname);
    // 8 at a time: fast enough for a few hundred files, gentle on both stores
    await Promise.all(Array.from({ length: 8 }, async () => { for (let p; (p = work.shift()); ) await one(p); }));
    cursor = page.cursor;
  } while (cursor);
  return Response.json(out);

  async function one(p) {
      try {
        const old = await readBlob(p);
        if (old == null) { out.skipped++; return; }
        if (p === "meta/roster.json") {
          await updateJSON(p, (cur) => ({
            admins: [...new Set([...(old.admins || []), ...(cur.admins || [])])],
            early: old.early || cur.early,
            restored: [...new Set([...(cur.restored || []), ...(old.restored || [])])],
          }));
          out.other++;
        } else if (p.startsWith("members/")) {
          const cur = await readJSON(p);
          await writeJSON(p, { ...(cur || {}), ...old, legacyChecked: true, botSeenAt: Math.max(old.botSeenAt || 0, cur?.botSeenAt || 0) || undefined });
          out.members++;
        } else if (p.startsWith("users/")) {
          const cur = await readJSON(p);
          if (!cur || (old.updatedAt || 0) > (cur.updatedAt || 0)) await writeJSON(p, old);
          out.states++;
        } else if (p === "meta/stats.json") {
          await updateJSON(p, (cur) => ({ views: Math.max(cur.views || 0, old.views || 0) }));
          out.other++;
        } else {
          if ((await readJSON(p)) == null) await writeJSON(p, old);
          out.other++;
        }
      } catch (e) { out.failed.push(p + ": " + String(e?.message || e).slice(0, 80)); }
  }
}
