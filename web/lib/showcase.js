// Public landing-page data. Signed-out visitors see what Free sees: ranks 1–lockN are a teaser
// (rank, score, ≈฿/order — no id, name, image or link); the shown products start at lockN + 1.
import { rank, effPrice } from "./score";

const SHOW = 5;

export function showcase(all, { lockN = 5, show = SHOW } = {}) {
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];
  return cats.map((c) => {
    const list = all.filter((p) => p.category === c);
    const r = rank(list);
    return {
      category: c,
      updatedAt: Math.max(0, ...list.map((p) => p.fetchedAt || 0)),
      count: list.length,
      locked: r.slice(0, lockN).map((p, i) => ({ rank: i + 1, score: Math.round(p._t), perOrder: Math.round(p._perOrder) })),
      items: r.slice(lockN, lockN + show).map((p, i) => ({
        rank: lockN + i + 1,
        id: p.id, name: p.name, image: p.image, price: effPrice(p), commission: +p.commission || 0, perOrder: Math.round(p._perOrder * 10) / 10,
        sold: +p.sold || 0, rating: +p.rating || 0, shop: p.shop || "", data: Math.round(p._d.total), ai: p._a ? Math.round(p._a.total) : null, total: Math.round(p._t),
        hook: p.ai?.hook || "", angles: p.ai?.angles || [], link: p.affLink || p.url || "",
      })),
    };
  }).sort((a, b) => b.count - a.count);
}
