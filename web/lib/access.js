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
export const ANNOUNCE_FROM = Date.parse("2026-10-29T00:00:00+07:00"); // countdown line + banner
export const PAYWALL_AT = Date.parse("2026-10-30T00:00:00+07:00"); // D0: V2 turns on by itself (midnight 29→30 Oct)

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

// Before D0: one line for Free replies/pages announcing the change. Empty outside the window or when V2 is off.
// Turned off 29 Oct — the change is announced once instead. Set to true to bring the line back.
const COUNTDOWN_ON = false;
export async function countdownLine(view) {
  if (!COUNTDOWN_ON) return "";
  const now = Date.now();
  if (view?.pro || now < ANNOUNCE_FROM || now >= PAYWALL_AT) return "";
  const v = (await flags()).paywallV2;
  if (v === "off" || process.env.PAYWALL_V2 === "off") return "";
  const d = Math.ceil((PAYWALL_AT - now) / 864e5);
  return `⏳ ${d <= 1 ? "คืนนี้เที่ยงคืน" : `อีก ${d} วัน`} แพ็ก Free เปลี่ยนเป็นดูได้วันละ 1 หมวด · AI ${RULES.freeV2.aiPerDay} ครั้ง · ลิงก์ ${RULES.freeV2.linksPerDay} ลิงก์/วัน · อยากดูครบทุกหมวด อัปเกรด Pro`;
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

// AI ideas opened today: distinct baskets, cached or not (reopening one already opened today is free).
// Pro and V1 Free are unlimited here — V1 only ever capped fresh AI calls (lib/ai.js), not views.
export function aiAllowed(m, view, id) {
  const lim = view.v2 && !view.pro ? view.rules.aiPerDay : Infinity;
  if (lim === Infinity) return { ok: true, limit: lim, left: null };
  const ids = m.aiSeen?.day === bkkDay() ? m.aiSeen.ids : [];
  if (ids.includes(id)) return { ok: true, limit: lim, left: Math.max(0, lim - ids.length), seen: true };
  return ids.length >= lim ? { ok: false, limit: lim, left: 0 } : { ok: true, limit: lim, left: lim - ids.length - 1 };
}
// Record the basket as opened. Returns true when the member changed (caller saves).
export function markAi(m, view, id) {
  if (!(view.v2 && !view.pro)) return false;
  const ids = m.aiSeen?.day === bkkDay() ? m.aiSeen.ids : [];
  if (ids.includes(id)) return false;
  m.aiSeen = { day: bkkDay(), ids: [...ids, id] };
  return true;
}
// Free V2 doesn't get the shared AI score in the catalog — it opens one a day through aiAllowed.
const noAi = ({ ai, ...p }) => p;

// Why a locked product ranks high, in words — the score's own signals that are strong (≥70% of their weight),
// in order of how much they say about a clip: sales speeding up, AI clip-ability, demand, commission, trust, then price/shop.
// Shows the reason without the name, price or commission %, so it sells Pro without giving the product away.
const REASONS = [
  ["problem", 15, "โชว์ปัญหา→ทางแก้ได้ใน 3 วิ"], ["visual", 15, "มีภาพหยุดนิ้ว"], ["multi", 10, "ต่อยอดได้หลายคลิป"],
  ["demand", 20, "ขายดีมากในหมวด"], ["commission", 15, "ค่าคอมสูง"], ["trust", 10, "รีวิวดี ลูกค้ามั่นใจ"],
  ["price", 10, "ราคาซื้อง่าย"], ["shop", 5, "ร้าน Mall/แนะนำ"],
];
export function whyGood(p, n = 2) {
  const parts = { ...(p._d?.parts || {}), ...(p._a?.parts || {}) };
  const out = [];
  if (p._boost >= 1.5) out.push(`ยอดพุ่ง ${p._boost.toFixed(1)} เท่าจากปกติ`);
  else if (p._perDay) out.push(`ขายวันละ ~${Math.round(p._perDay).toLocaleString("en-US")} ชิ้น`);
  for (const [k, max, label] of REASONS) if ((parts[k] || 0) / max >= 0.7) out.push(label);
  return out.slice(0, n);
}

// Teaser rows for a locked block: rank, blurred image, score and why — never name, link, id or price.
export const lockRows = (items) => items.map((p, i) => ({ rank: i + 1, image: p.image || "", category: p.category || "", score: Math.round(p._t || 0), max: p._a ? 100 : 60, why: whyGood(p) }));

// Card-safe copy of a ranked product: no owner link/sub-id, but keeps the scores the cards show.
export const forCard = (p) => ({ ...publicProduct(p), _t: p._t, _a: p._a, _perOrder: p._perOrder, ...(p._perDay != null ? { _perDay: p._perDay, _boost: p._boost } : {}) });

const categories = (all) => [...new Set(all.map((p) => p.category).filter(Boolean))];

// The shared catalog for one view.
// Pro: every product. Free: `rules.show` per category, starting after LOCK_N when lockCat.
// `only`: restrict to one category (Free V2 on the web). `cats` lists every category with its size.
// `lockedIds` stays on the server so searches can't surface the locked products.
export async function sharedCatalog({ pro, v2, lockCat, rules = RULES.free }, { only } = {}) {
  const cut = v2 && !pro ? noAi : (p) => p;
  const all = await ownerProducts();
  const products = {}, locked = {}, lockedIds = new Set();
  const cats = categories(all).map((c) => ({ name: c, count: all.filter((p) => p.category === c).length }));
  for (const { name: c } of cats) {
    const r = rank(all.filter((p) => p.category === c));
    if (pro) { r.forEach((p) => { products[p.id] = publicProduct(p); }); continue; }
    const start = lockCat ? LOCK_N : 0;
    if (lockCat) r.slice(0, LOCK_N).forEach((p) => lockedIds.add(p.id));
    if (only !== undefined && c !== only) continue;
    r.slice(start, start + rules.show).forEach((p, i) => { products[p.id] = { ...cut(publicProduct(p)), _rank: start + i + 1 }; });
    if (lockCat) locked[c] = lockRows(r.slice(0, LOCK_N));
  }
  return { products, locked, lockedIds, cats };
}

// ท็อปรวมวันนี้: the #1 of every category, best first. Pro ranks its own products (`own`, e.g. its scans).
export async function topAll({ pro, v2, rules = RULES.free, own }) {
  const mine = pro && own?.length > 0;
  const src = mine ? own : await ownerProducts();
  const firsts = categories(src).map((c) => rank(src.filter((p) => p.category === c))[0]).filter(Boolean).sort((a, b) => b._t - a._t).slice(0, TOP_ALL_N);
  const n = pro ? 0 : Math.min(LOCK_N, firsts.length);
  const shown = firsts.slice(n, n + rules.show);
  return { locked: lockRows(firsts.slice(0, n)), items: shown.map((p, i) => ({ ...(mine ? p : v2 && !pro ? noAi(forCard(p)) : forCard(p)), _n: n + i + 1 })), cats: categories(src) };
}

// มาแรงวันนี้: products selling faster than their own 30-day average, across categories.
export async function hotView({ pro, v2, rules = RULES.free, proShow }) {
  const { items, since } = await trending(await ownerProducts(), 20);
  const n = pro ? 0 : Math.min(LOCK_N, items.length);
  const shown = items.slice(n, n + (pro ? proShow || rules.hot : rules.hot));
  return { since, locked: lockRows(items.slice(0, n)), items: shown.map((p, i) => ({ ...(v2 && !pro ? noAi(forCard(p)) : forCard(p)), _n: n + i + 1 })), more: items.length - n - shown.length };
}
