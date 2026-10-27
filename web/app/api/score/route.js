// AI clipability score for ONE product (see lib/ai.js).
import { requireMember } from "../../../lib/auth";
import { scoreItem } from "../../../lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const { item, refresh } = (await req.json().catch(() => ({}))) || {};
  const r = await scoreItem(member, item, refresh);
  if (r.error) return Response.json({ error: r.error, detail: r.detail }, { status: r.status || 500 });
  return Response.json(r);
}
