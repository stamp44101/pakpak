// "สรุปก่อน 11.11": a tier list of baskets from the owner's latest scan (the shared catalog).
// Pro members get it free, Free members buy it as a ฿69 add-on (plan.js ORDERS.r1111). Pure function of the product list.
import { effPrice } from "./score";
import { commChange } from "./commission";

const PER_ORDER_CAP = 150;        // a ฿52,900 phone must not outrank everything just because one order pays a lot
const HIGH_TICKET = 5000;
const CAPS = { S: 12, A: 24, B: 20, H: 6, D: 13, U: 8 };

const junk = (p) => /not for sale/i.test(p.name || "") || effPrice(p) <= 1;

function row(p, ch) {
  const price = effPrice(p), hist = +p.historicalSold || 0, sold = +p.sold || 0;
  return {
    id: p.id, name: p.name || "", category: p.category || "", image: p.image || "",
    price, commission: +p.commission || 0, perOrder: (price * (+p.commission || 0)) / 100,
    sold, rating: +p.rating || 0, share: hist > 0 ? Math.min(100, Math.round((100 * sold) / hist)) : 0,
    ...(ch ? { ch: { from: ch.from, to: ch.to } } : {}),
    url: p.id && p.id.includes("_") ? `https://shopee.co.th/product/${p.id.split("_")[0]}/${p.id.split("_")[1]}` : p.url || "",
  };
}

export function buildReport(products, now = Date.now()) {
  const list = (products || []).filter((p) => !junk(p));
  const T = { S: [], A: [], B: [], H: [], D: [], U: [] };
  let dAll = 0, rest = 0;
  for (const p of list) {
    const ch = commChange(p, now), r = row(p, ch);
    const drop = !!ch?.down, lowRate = r.rating > 0 && r.rating < 4.6;
    if ((r.sold >= 5000 && r.perOrder < 2) || (r.sold >= 1000 && (lowRate || drop))) { dAll++; T.D.push(r); continue; }
    if (ch && !ch.down && r.sold >= 300) T.U.push(r);
    if (r.price > HIGH_TICKET) { if (r.sold >= 50 && r.rating >= 4.7) T.H.push(r); else rest++; continue; }
    const o = Math.min(r.perOrder, PER_ORDER_CAP);
    if (o >= 20 && r.sold >= 2000 && r.rating >= 4.8 && r.share >= 12) T.S.push(r);
    else if (o >= 10 && r.sold >= 1000 && r.rating >= 4.7) T.A.push(r);
    else if (o >= 5 && r.sold >= 500) T.B.push(r);
    else rest++;
  }
  const byMoney = (a, b) => b.perOrder - a.perOrder || b.sold - a.sold;
  for (const k of ["S", "A", "B", "H", "U"]) T[k].sort(byMoney);
  T.D.sort((a, b) => b.sold - a.sold);
  const counts = { S: T.S.length, A: T.A.length, B: T.B.length, H: T.H.length, D: dAll, U: T.U.length, C: rest };
  const tiers = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.slice(0, CAPS[k])]));
  const money = [...T.S, ...T.A, ...T.B].sort(byMoney).slice(0, 10);
  return { gen: now, total: list.length, counts, tiers, money };
}

// What a member who hasn't unlocked it gets: only the shape of the report.
export function teaser(rep) {
  return { gen: rep.gen, total: rep.total, counts: rep.counts, locked: true,
    cats: Object.entries(rep.tiers.S.reduce((a, x) => ((a[x.category] = (a[x.category] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c) };
}
