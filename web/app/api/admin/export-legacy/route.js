// Owner-only: download every file of the old Vercel Blob store as one JSON backup
// ({ exportedAt, count, files: { path: data } }). Works only while the store is readable.
import { list, get } from "@vercel/blob";
import { requireMember, roster } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  if ((await roster()).admins[0] !== member.id) return Response.json({ error: "เจ้าของเท่านั้น" }, { status: 403 });
  const paths = [];
  let cursor;
  do { const page = await list({ cursor, limit: 1000 }); paths.push(...page.blobs.map((b) => b.pathname)); cursor = page.cursor; } while (cursor);
  const files = {}, failed = [];
  const work = [...paths];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let p; (p = work.shift()); ) {
      try {
        const r = await get(p, { access: "private", useCache: false });
        const text = r && r.statusCode === 200 && r.stream ? await new Response(r.stream).text() : null;
        try { files[p] = JSON.parse(text); } catch { files[p] = text; }
      } catch (e) { failed.push(p); }
    }
  }));
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), store: "pakpak-data", count: Object.keys(files).length, failed, files }), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="pakpak-blob-backup-${day}.json"` },
  });
}
