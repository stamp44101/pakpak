// Admin: let AI score the top 3 of every category so the landing demo shows real hooks.
import { requireMember, isAdmin, getMember } from "../../../../lib/auth";
import { readJSON, writeJSON } from "../../../../lib/store";
import { rank, effPrice } from "../../../../lib/score";
import { scoreItem } from "../../../../lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  if (!(await isAdmin(member.id))) return Response.json({ error: "สำหรับผู้ดูแลเท่านั้น" }, { status: 403 });
  const path = `users/m_${member.id}.json`;
  const state = await readJSON(path);
  const all = Object.values(state?.products || {});
  const todo = [];
  for (const c of new Set(all.map((p) => p.category))) todo.push(...rank(all.filter((p) => p.category === c)).slice(0, 3).filter((p) => !p.ai));
  const done = [], failed = [];
  for (let i = 0; i < todo.length; i += 6) {
    const batch = todo.slice(i, i + 6);
    const res = await Promise.all(batch.map((p) => scoreItem(member, { id: p.id, name: p.name, price: effPrice(p), category: p.category })));
    res.forEach((r, k) => (r.score ? done.push([batch[k].id, r.score]) : failed.push(r.error)));
  }
  const cur = (await readJSON(path)) || state;
  for (const [id, s] of done) if (cur.products[id]) cur.products[id].ai = s;
  cur.updatedAt = Date.now();
  await writeJSON(path, cur);
  return Response.json({ scored: done.length, failed });
}
