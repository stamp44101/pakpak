// "มาแรงวันนี้" across all categories. Free: ranks 1–5 locked (teaser only), ranks 6–8 shown. Pro: top 20. Never the owner's affiliate links.
import { requireMember } from "../../../lib/auth";
import { ownerProducts, publicProduct } from "../../../lib/catalog";
import { isPro } from "../../../lib/plan";
import { trending } from "../../../lib/trending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_TRENDING = 3, LOCK = 5;

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const pro = isPro(member);
  const { items, since } = await trending(await ownerProducts(), 20);
  const start = pro ? 0 : Math.min(LOCK, items.length);
  const shown = pro ? items : items.slice(start, start + FREE_TRENDING);
  return Response.json({
    since,
    more: items.length - start - shown.length,
    locked: pro ? [] : items.slice(0, start).map((p, i) => ({ rank: i + 1, image: p.image || "", category: p.category || "", perOrder: Math.round(p._perOrder || 0) })),
    items: shown.map((p, i) => ({ ...publicProduct(p), rank: start + i + 1, perDay: Math.round(p._perDay), boost: +p._boost.toFixed(1), perOrder: Math.round(p._perOrder) })),
  });
}
