// Public demo data for the landing page: the owner's real ranked products, top 5 per category.
// No member data leaves here except product facts + the owner's own affiliate links.
import { roster } from "../../../lib/auth";
import { readJSON } from "../../../lib/store";
import { rank, effPrice } from "../../../lib/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await roster();
  const owner = r.admins[0];
  const state = owner ? await readJSON(`users/m_${owner}.json`) : null;
  const all = Object.values(state?.products || {});
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];
  const out = cats.map((c) => {
    const list = all.filter((p) => p.category === c);
    return {
      category: c,
      updatedAt: Math.max(0, ...list.map((p) => p.fetchedAt || 0)),
      count: list.length,
      items: rank(list).slice(0, 5).map((p) => ({
        id: p.id, name: p.name, image: p.image, price: effPrice(p), commission: +p.commission || 0, perOrder: Math.round(p._perOrder * 10) / 10,
        sold: +p.sold || 0, rating: +p.rating || 0, shop: p.shop || "", data: Math.round(p._d.total), ai: p._a ? Math.round(p._a.total) : null, total: Math.round(p._t),
        hook: p.ai?.hook || "", angles: p.ai?.angles || [], link: p.affLink || p.url || "",
      })),
    };
  }).sort((a, b) => b.count - a.count);
  return Response.json({ categories: out }, { headers: { "cache-control": "public, s-maxage=1800, stale-while-revalidate=86400" } });
}
