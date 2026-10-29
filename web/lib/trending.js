// "มาแรงวันนี้": products across all categories whose sales are speeding up, compared with their own past.
// Every time the owner saves scanned products we keep one snapshot per Bangkok day of each product's
// cumulative sales (historicalSold) in meta/sold-history.json. Comparing today's numbers with an earlier day
// gives units sold per day; dividing by the product's usual daily rate (sold over the last 30 days / 30)
// makes products from different categories comparable — a snack and an air fryer each against their own normal.
import { readJSON, updateJSON } from "./store";
import { rank } from "./score";

const PATH = "meta/sold-history.json";
const KEEP_DAYS = 8;
const MIN_PER_DAY = 3; // ignore tiny sellers whose ratio is noise
const dayKey = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10);

// Called when the owner saves products (a scan), not per request: at most one write per save.
export async function recordSold(products) {
  const s = {};
  for (const p of Object.values(products || {})) if (+p.historicalSold > 0) s[p.id] = +p.historicalSold;
  if (!Object.keys(s).length) return;
  const today = dayKey();
  await updateJSON(PATH, (h) => {
    const days = { ...(h.days || {}) };
    days[today] = { t: Date.now(), s: { ...(days[today]?.s || {}), ...s } };
    for (const d of Object.keys(days).sort().slice(0, -KEEP_DAYS)) delete days[d];
    return { days };
  });
}

// Ranked list across categories. Each item gets _perDay (units/day since the earlier snapshot)
// and _boost (how many times faster than its 30-day average).
export async function trending(products, limit = 20) {
  const h = (await readJSON(PATH)) || {};
  const today = dayKey();
  const past = Object.keys(h.days || {}).filter((d) => d < today).sort().reverse(); // newest earlier day first
  if (!past.length) return { items: [], since: null };
  // rank within each category first so items carry the usual score (_t) for cards
  const ranked = [];
  for (const c of new Set(products.map((p) => p.category))) ranked.push(...rank(products.filter((p) => p.category === c)));
  const out = [];
  let since = null;
  for (const p of ranked) {
    const now = +p.historicalSold;
    if (!(now > 0)) continue;
    const d = past.find((k) => h.days[k].s[p.id] != null);
    if (!d) continue;
    const days = ((p.fetchedAt || Date.now()) - h.days[d].t) / 864e5;
    if (days < 0.5) continue;
    const perDay = (now - h.days[d].s[p.id]) / days;
    if (perDay < MIN_PER_DAY) continue;
    const boost = perDay / Math.max((+p.sold || 0) / 30, 1);
    since = since == null ? h.days[d].t : Math.min(since, h.days[d].t);
    out.push({ ...p, _perDay: perDay, _boost: boost, _hot: boost * Math.log1p(perDay) });
  }
  out.sort((a, b) => b._hot - a._hot);
  // at most 3 per category so one busy category can't fill the list
  const per = {}, items = [];
  for (const p of out) {
    if ((per[p.category] = (per[p.category] || 0) + 1) > 3) continue;
    items.push(p);
    if (items.length >= limit) break;
  }
  return { items, since };
}
