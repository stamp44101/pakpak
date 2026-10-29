// Free vs Pro. Early Access members get Pro for 30 days; the owner (first admin) is Pro without expiry.
export const PLANS = {
  free: { name: "Free", aiPerDay: 3, scan: false, autoLinks: false, topPerCat: 5 },
  pro: { name: "Pro", aiPerDay: 30, scan: true, autoLinks: true, topPerCat: Infinity },
};
export const PRICE = { month: 199, year: 1990, early: 99 };
export const EA_DAYS = 30; // Early Access: Pro free for this long
export const ADMIN_TRIAL_DAYS = 7; // "🎁 ทดลองฟรี" button in /admin, once per member

// Paid plans, so price / length / wording come from one place. f* = Founding price: offered per member by an admin
// (m.foundingOffer, from /admin) and kept forever once bought (m.founding).
export const ORDERS = {
  month: { price: PRICE.month, days: 30, label: "รายเดือน", span: "1 เดือน" },
  year: { price: PRICE.year, days: 365, label: "รายปี", span: "1 ปี" },
  fmonth: { price: 99, days: 30, label: "Founding รายเดือน", span: "1 เดือน", founding: true },
  fyear: { price: 990, days: 365, label: "Founding รายปี", span: "1 ปี", founding: true },
};
// ฿99 promo sent by an admin (/admin → "🎁 เสนอ ฿99", one member or the whole "สนใจ Pro" group).
// m.promo = { at, until, by, interestedAt?, declinedAt?, plan?, paidAt? } tracks the card's funnel; the price ends at `until`.
export const PROMO_HOURS = 48;
export const promoLive = (m) => !!(m?.foundingOffer && (!m.promo?.until || m.promo.until > Date.now()));
// Founding prices: only for members an admin offered them to (still within the promo window), or who already bought one.
export const foundingOpen = (m) => !!(m?.founding || promoLive(m));
// What a member is allowed to pick: a founding plan only while foundingOpen, else the matching regular one.
export const pickOrder = (m, p) => (ORDERS[p]?.founding && !foundingOpen(m) ? (p === "fyear" ? "year" : "month") : ORDERS[p] ? p : "month");
export const orderOf = (plan) => ORDERS[plan] || ORDERS.month;
// A chosen plan with no slip after this long is cancelled (a late slip still revives it, see webhook).
export const ORDER_TTL_H = 24;
export function expireOrder(m) {
  const o = m?.pendingOrder;
  if (!o || o.slipAt || Date.now() - (o.at || 0) < ORDER_TTL_H * 36e5) return false;
  m.orderExpired = { plan: o.plan, at: o.at, expiredAt: Date.now() };
  m.pendingOrder = null;
  return true;
}

export const isPro = (m) => m?.plan === "pro" && (!m.proUntil || m.proUntil > Date.now());
export const planOf = (m) => (isPro(m) ? "pro" : "free");
export const limits = (m) => PLANS[planOf(m)];

// Give Pro for `days` (stacking on time left), or forever with days = null.
export function grantPro(m, days, { early = false } = {}) {
  if (early) m.earlyAccess = true;
  if (m.plan === "pro" && m.proUntil === null && days != null) return m; // already Pro forever: nothing to extend
  m.plan = "pro";
  m.proUntil = days == null ? null : Math.max(Date.now(), isPro(m) && m.proUntil ? m.proUntil : 0) + days * 864e5;
  return m;
}

// Admins (owner + co-admins) are Pro with no expiry.
export function makeAdminPro(m) { m.plan = "pro"; m.proUntil = null; m.pendingOrder = null; return m; }

export const planInfo = (m) => ({ plan: planOf(m), proUntil: isPro(m) ? m.proUntil || null : null, earlyAccess: !!m?.earlyAccess, limits: { ...limits(m), topPerCat: limits(m).topPerCat === Infinity ? null : limits(m).topPerCat } });
