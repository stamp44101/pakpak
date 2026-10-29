// "มาแรงวันนี้" across all categories. Free sees the top 3, Pro the top 20. Never the owner's affiliate links.
import { requireMember } from "../../../lib/auth";
import { ownerProducts, publicProduct } from "../../../lib/catalog";
import { isPro } from "../../../lib/plan";
import { trending } from "../../../lib/trending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_TRENDING = 3;

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const pro = isPro(member);
  const { items, since } = await trending(await ownerProducts(), 20);
  const shown = pro ? items : items.slice(0, FREE_TRENDING);
  return Response.json({
    since,
    more: items.length - shown.length,
    items: shown.map((p) => ({ ...publicProduct(p), perDay: Math.round(p._perDay), boost: +p._boost.toFixed(1), perOrder: Math.round(p._perOrder) })),
  });
}
