// AI clipability score for ONE product (see lib/ai.js).
import { requireMember } from "../../../lib/auth";
import { scoreItem } from "../../../lib/ai";
import { saveMember } from "../../../lib/auth";
import { viewOf, aiAllowed, markAi } from "../../../lib/access";
import { PLANS } from "../../../lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const { item, refresh } = (await req.json().catch(() => ({}))) || {};
  const view = await viewOf(member);
  const id = String(item?.id || "");
  const gate = aiAllowed(member, view, id);
  if (!gate.ok) return Response.json({ error: `แพ็ก Free ดูไอเดีย AI ได้วันละ ${gate.limit} ตะกร้า ครบแล้ววันนี้ (ตะกร้าที่เปิดแล้วดูซ้ำได้) · Pro ได้วันละ ${PLANS.pro.aiPerDay} ตะกร้า`, upgrade: true }, { status: 429 });
  const r = await scoreItem(member, item, refresh && view.pro);
  if (!r.error && markAi(member, view, id)) await saveMember(member);
  if (r.error) return Response.json({ error: r.error, detail: r.detail }, { status: r.status || 500 });
  return Response.json(r);
}
