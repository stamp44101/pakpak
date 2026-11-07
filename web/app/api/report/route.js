// "สรุปก่อน 11.11": full report for Pro / ฿69 buyers / admins, only counts for everyone else.
import { requireMember } from "../../../lib/auth";
import { ownerProducts } from "../../../lib/catalog";
import { canReport1111, ORDERS } from "../../../lib/plan";
import { buildReport, teaser } from "../../../lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const g = await requireMember(req);
  if (g.error) return g.error;
  const rep = buildReport(await ownerProducts());
  if (!canReport1111(g.member)) return Response.json({ ...teaser(rep), price: ORDERS.r1111.price, pending: !!g.member.pendingOrder && g.member.pendingOrder.plan === "r1111" });
  return Response.json(rep, { headers: { "cache-control": "private, no-store" } });
}
