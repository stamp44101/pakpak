// Commission changes between scans. Shopee changes rates without notice (e.g. 12% → 9%),
// and the catalog only keeps the latest number — so remember the previous one when it moves.
const SHOW_MS = 14 * 864e5; // label stays up for 14 days after the change
const MIN_DIFF = 0.5;       // ignore rounding noise

// Fields to carry into the merged product, given the stored product and the fresh scan item.
export function commFields(old, fresh, now = Date.now()) {
  const prev = old ? +old.commission : NaN, cur = +fresh.commission;
  if (Number.isFinite(prev) && Number.isFinite(cur) && Math.abs(prev - cur) >= MIN_DIFF) return { commPrev: prev, commChangedAt: now };
  return old && old.commChangedAt ? { commPrev: old.commPrev, commChangedAt: old.commChangedAt } : {};
}

// { from, to, down, at } while the change is recent, else null.
export function commChange(p, now = Date.now()) {
  if (!p || !p.commChangedAt || now - p.commChangedAt > SHOW_MS) return null;
  const from = +p.commPrev, to = +p.commission || 0;
  if (!Number.isFinite(from) || Math.abs(from - to) < MIN_DIFF) return null;
  return { from, to, down: to < from, at: p.commChangedAt };
}

export const commLabel = (c) => `คอม${c.down ? "ลด" : "ขึ้น"} ${Math.round(c.from)}→${Math.round(c.to)}%`;
