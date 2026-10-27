// Free vs Pro. Early Access members get Pro for 30 days; the owner (first admin) is Pro without expiry.
export const PLANS = {
  free: { name: "Free", aiPerDay: 3, scan: false, autoLinks: false, topPerCat: 5 },
  pro: { name: "Pro", aiPerDay: 30, scan: true, autoLinks: true, topPerCat: Infinity },
};
export const PRICE = { month: 199, year: 1990, early: 99 };
export const TRIAL_DAYS = 30;

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

export const planInfo = (m) => ({ plan: planOf(m), proUntil: isPro(m) ? m.proUntil || null : null, earlyAccess: !!m?.earlyAccess, limits: { ...limits(m), topPerCat: limits(m).topPerCat === Infinity ? null : limits(m).topPerCat } });
