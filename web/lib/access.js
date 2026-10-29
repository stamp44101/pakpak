// Who sees what. Every Free/Pro rule lives here, shared by the web and the LINE bot.
//
// Free before Paywall V2 (v1)                         Free with Paywall V2 (from PAYWALL_AT, flag "paywallV2")
//   ท็อปรายหมวด  5/หมวด (สวิตช์ล็อกท็อป: #1–5 ล็อก)       วันละ 1 หมวด, #1–5 ล็อก, เห็น #6–8
//   ท็อปรวม      #1–5 ล็อก, เห็น #6–10                    #1–5 ล็อก, เห็น #6–8
//   มาแรง        #1–5 ล็อก, เห็น #6–8                     #1–5 ล็อก, เห็น #6–8
//   AI ไอเดีย     3/วัน                                    1/วัน
//   ลิงก์ Aff ID  ไม่จำกัด                                 3/วัน
// Pro: everything, AI 30/วัน, links unlimited.
// A locked product is only a teaser (rank, blurred image, ≈฿/order) — never its name, link or id.
import { ownerProducts, publicProduct } from "./catalog";
import { flags, bucket } from "./flags";
import { rank } from "./score";
import { trending } from "./trending";
import { isPro, PLANS } from "./plan";
import { saveMember } from "./auth";

export const LOCK_N = 5; // ranks hidden from Free
export const TOP_ALL_N = 10; // ท็อปรวมวันนี้: one product per category, at most this many

export const RULES = {
  free: { show: 5, hot: 3, aiPerDay: PLANS.free.aiPerDay, linksPerDay: Infinity, oneCat: false },
  freeV2: { show: 3, hot: 3, aiPerDay: 1, linksPerDay: 3, oneCat: true },
  pro: { show: Infinity, hot: 10, aiPerDay: PLANS.pro.aiPerDay, linksPerDay: Infinity, oneCat: false },
};
export const FREE_PER_CAT = RULES.free.show; // v1 number, for copy that predates V2

// ---- Paywall V2 timeline (pakpak-paywall-plan.md) ----
export const ANNOUNCE_FROM = Date.parse("2026-10-30T00:00:00+07:00"); // countdown line + banner
export const PAYWALL_AT = Date.parse("2026-11-04T00:00:00+07:00"); // D0: V2 turns on by itself

// paywallV2 flag: "auto" (default — on from PAYWALL_AT) | "on" | "off" | "admin" (only admins previewing "ดูแบบ free").
// Env PAYWALL_V2=off is the emergency kill switch (needs a redeploy).
export function paywallFor(f, { adminPreview = false } = {}) {
  if (process.env.PAYWALL_V2 === "off") return false;
  const v = f?.paywallV2 || "auto";
  if (v === "off") return false;
  if (v === "on") return true;
  if (v === "admin") return adminPreview;
  return Date.now() >= PAYWALL_AT;
}
export const paywallLabel = (v) => ({ on: "เปิดแล้ว (ทุกคน)", off: "ปิด (Free แบบเดิม)", admin: "ทดสอบเฉพาะแอดมิน (\"ดูแบบ free\")" })[v] || `อัตโนมัติ: เปิดเอง ${new Date(PAYWALL_AT).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })} 00:00`;
// Free rules right now, for copy that has no member (welcome, sign-up card).
export async function freeRulesNow() { return paywallFor(await flags()) ? RULES.freeV2 : RULES.free; }

// D-5 → D-1: one line for Free replies/pages announcing the change. Empty outside the window or when V2 is off.
export async function countdownLine(view) {
  const now = Date.now();
  if (view?.pro || now < ANNOUNCE_FROM || now >= PAYWALL_AT) return "";
  const v = (await flags()).paywallV2;
  if (v === "off" || process.env.PAYWALL_V2 === "off") return "";
  const d = Math.ceil((PAYWALL_AT - now) / 864e5);
  return `⏳ อีก ${d} วันแพ็ก Free เหลือวันละ 1 หมวด ${RULES.freeV2.show} ตัว · ล็อกราคา Founding ฿99 ตลอดไปได้ถึง 3 พ.ย.`;
}

// lockTop5 switch (v1 only): "off" | "admin" | 1–100 (% of Free members). Env LOCK_TOP5=off is the kill switch.
export function lockTop5For(f, m, { adminPreview = false } = {}) {
  if (process.env.LOCK_TOP5 === "off") return false;
  const v = f?.lockTop5;
  if (!v || v === "off") return false;
  if (adminPreview) return true;
  if (v === "admin") return false;
  return bucket(m?.id) < Math.min(100, +v || 0);
}
export const lockLabel = (v) => (!v || v === "off" ? "ปิด (ทุกคนเห็นท็อป 1–5 ตามเดิม)" : v === "admin" ? "ทดสอบเฉพาะแอดมิน (\"ดูแบบ free\")" : `เปิด ${v}% ของผู้ใช้ Free`);

// One member's view: Pro or not (admins preview Free with "ดูแบบ free"), V2 or not, and the rules that follow.
export async function viewOf(m, { admin = false } = {}) {
  const preview = admin && !!m?.viewAsFree;
  const pro = isPro(m) && !preview;
  const f = await flags();
  const v2 = !pro && paywallFor(f, { adminPreview: preview });
  const lockCat = !pro && (v2 || lockTop5For(f, m, { adminPreview: preview }));
  return { pro, v2, lockCat, rules: pro ? RULES.pro : v2 ? RULES.freeV2 : RULES.free };
}

// ---- daily allowances (Bangkok day), kept on the member ----
export const bkkDay = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10);
export const todayCat = (m) => (m?.dayCat?.day === bkkDay() ? m.dayCat.cat : null);
// Free V2: the first category opened today is the one for the whole day.
export async function chooseCat(m, cat, view) {
  if (!view.rules.oneCat || !cat) return { ok: true };
  const cur = todayCat(m);
  if (cur) return cur === cat ? { ok: true } : { ok: false, cat: cur };
  m.dayCat = { day: bkkDay(), cat };
  await saveMember(m);
  return { ok: true, first: true };
}
// Affiliate-ID links made today. Counts on the member object; the caller saves it.
export function useLink(m, view) {
  const lim = view.rules.linksPerDay;
  const used = m.links?.day === bkkDay() ? m.links.count : 0;
  if (used >= lim) return { ok: false, limit: lim };
  m.links = { day: bkkDay(), count: used + 1 };
  return { ok: true, left: lim === Infinity ? null : lim - used - 1 };
}

// Teaser rows for a locked block.
export const lockRows = (items) => items.map((p, i) => ({ rank: i + 1, image: p.image || "", category: p.category || "", perOrder: Math.round(p._perOrder || 0) }));

// Card-safe copy of a ranked product: no owner link/sub-id, but keeps the scores the cards show.
export const forCard = (p) => ({ ...publicProduct(p), _t: p._t, _a: p._a, _perOrder: p._perOrder, ...(p._perDay != null ? { _perDay: p._perDay, _boost: p._boost } : {}) });

const categories = (all) => [...new Set(all.map((p) => p.category).filter(Boolean))];

// The shared catalog for one view.
// Pro: every product. Free: `rules.show` per category, starting after LOCK_N when lockCat.
// `only`: restrict to one category (Free V2 on the web). `cats` lists every category with its size.
// `lockedIds` stays on the server so searches can't surface the locked products.
export async function sharedCatalog({ pro, lockCat, rules = RULES.free }, { only } = {}) {
  const all = await ownerProducts();
  const products = {}, locked = {}, lockedIds = new Set();
  const cats = categories(all).map((c) => ({ name: c, count: all.filter((p) => p.category === c).length }));
  for (const { name: c } of cats) {
    const r = rank(all.filter((p) => p.category === c));
    if (pro) { r.forEach((p) => { products[p.id] = publicProduct(p); }); continue; }
    const start = lockCat ? LOCK_N : 0;
    if (lockCat) r.slice(0, LOCK_N).forEach((p) => lockedIds.add(p.id));
    if (only !== undefined && c !== only) continue;
    r.slice(start, start + rules.show).forEach((p, i) => { products[p.id] = { ...publicProduct(p), _rank: start + i + 1 }; });
    if (lockCat) locked[c] = lockRows(r.slice(0, LOCK_N));
  }
  return { products, locked, lockedIds, cats };
}

// ท็อปรวมวันนี้: the #1 of every category, best first. Pro ranks its own products (`own`, e.g. its scans).
export async function topAll({ pro, rules = RULES.free, own }) {
  const mine = pro && own?.length > 0;
  const src = mine ? own : await ownerProducts();
  const firsts = categories(src).map((c) => rank(src.filter((p) => p.category === c))[0]).filter(Boolean).sort((a, b) => b._t - a._t).slice(0, TOP_ALL_N);
  const n = pro ? 0 : Math.min(LOCK_N, firsts.length);
  const shown = firsts.slice(n, n + rules.show);
  return { locked: lockRows(firsts.slice(0, n)), items: shown.map((p, i) => ({ ...(mine ? p : forCard(p)), _n: n + i + 1 })), cats: categories(src) };
}

// มาแรงวันนี้: products selling faster than their own 30-day average, across categories.
export async function hotView({ pro, rules = RULES.free, proShow }) {
  const { items, since } = await trending(await ownerProducts(), 20);
  const n = pro ? 0 : Math.min(LOCK_N, items.length);
  const shown = items.slice(n, n + (pro ? proShow || rules.hot : rules.hot));
  return { since, locked: lockRows(items.slice(0, n)), items: shown.map((p, i) => ({ ...forCard(p), _n: n + i + 1 })), more: items.length - n - shown.length };
}
