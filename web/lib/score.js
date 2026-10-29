export const DEFAULT_W = { demand: 20, commission: 15, trust: 10, price: 10, shop: 5, problem: 15, visual: 15, multi: 10, pmin: 99, pmax: 599, cfull: 12 };

// Shopee often lists a ฿1 teaser variant; score on the real upper price in that case.
export const effPrice = (p) => (+p.price <= 1 && +p.priceMax > 1 ? +p.priceMax : +p.price || 0);

export function dataScore(p, maxSold, w = DEFAULT_W) {
  const sold = +p.sold || 0, rate = +p.commission || 0, price = effPrice(p), rating = +p.rating || 0, rev = +p.reviews || 0;
  const demand = maxSold > 0 ? (w.demand * Math.log1p(sold)) / Math.log1p(maxSold) : 0;
  const commission = w.commission * Math.min(rate / w.cfull, 1);
  const trust = w.trust * (0.6 * Math.max(0, Math.min(rating - 4, 1)) + 0.4 * Math.min(Math.log1p(rev) / Math.log1p(1000), 1));
  let pf = 0;
  if (price > 0) pf = price >= w.pmin && price <= w.pmax ? 1 : price < w.pmin || price <= w.pmax * 1.7 ? 0.6 : 0.2;
  const shop = w.shop * ({ mall: 1, preferred: 0.6 }[p.shop] || 0);
  const total = demand + commission + trust + w.price * pf + shop;
  return { total, max: w.demand + w.commission + w.trust + w.price + w.shop, parts: { demand, commission, trust, price: w.price * pf, shop } };
}

export function aiScore(p, w = DEFAULT_W) {
  const a = p.ai;
  if (!a) return null;
  const c = (v, m) => (Math.max(0, Math.min(+v || 0, 10)) / 10) * m;
  const parts = { problem: c(a.problem, w.problem), visual: c(a.visual, w.visual), multi: c(a.multi, w.multi) };
  return { total: parts.problem + parts.visual + parts.multi, max: w.problem + w.visual + w.multi, parts };
}

export function rank(list, w = DEFAULT_W) {
  const maxSold = Math.max(0, ...list.map((p) => +p.sold || 0));
  return list
    .map((p) => {
      const d = dataScore(p, maxSold, w), a = aiScore(p, w);
      return { ...p, _d: d, _a: a, _t: d.total + (a ? a.total : 0), _perOrder: (effPrice(p) * (+p.commission || 0)) / 100 };
    })
    .sort((x, y) => y._t - x._t);
}
