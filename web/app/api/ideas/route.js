// Pro: personal extra clip ideas for one product (see moreIdea in lib/ai.js).
import { requireMember } from "../../../lib/auth";
import { myIdeas, moreIdea, IDEA_EXTRA } from "../../../lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const list = await myIdeas(member, new URL(req.url).searchParams.get("id"));
  return Response.json({ list, left: IDEA_EXTRA - list.length });
}

export async function POST(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const { item } = (await req.json().catch(() => ({}))) || {};
  const r = await moreIdea(member, item);
  if (r.error) return Response.json(r, { status: r.status || 500 });
  return Response.json(r);
}
