// Who sees what. Every Free/Pro rule about the shared catalog lives here, used by both the web and the LINE bot.
//
//   ท็อปรายหมวด    Free: top 5 per category; with the lockTop5 switch, ranks 1–5 locked and 6–10 shown. Pro: everything.
//   ท็อปรวมวันนี้   Free: always locked 1–5, ranks 6–10 shown.              Pro: top 10.
//   มาแรงวันนี้     Free: always locked 1–5, ranks 6–8 shown.               Pro: top 10 (bot) / 20 (web).
//
// A locked product is only a teaser (rank, blurred image, ≈฿/order) — never its name, link or id.
import { ownerProducts, publicProduct } from "./catalog";
import { flags, bucket } from "./flags";
import { rank } from "./score";
import { trending } from "./trending";
import { isPro } from "./plan";

export const LOCK_N = 5; // ranks hidden from Free
export const FREE_PER_CAT = 5; // products a Free member sees per category
export const FREE_HOT = 3; // มาแรง products a Free member sees after the lock
export const TOP_ALL_N = 10; // ท็อปรวมวันนี้: one product per category, at most this many

// lockTop5 switch: "off" | "admin" (only admins previewing with "ดูแบบ free") | 1–100 (% of Free members).
// Env LOCK_TOP5=off is the emergency kill switch (needs a redeploy).
export function lockTop5For(f, m, { adminPreview = false } = {}) {
  if (process.env.LOCK_TOP5 === "off") return false;
  const v = f?.lockTop5;
  if (!v || v === "off") return false;
  if (adminPreview) return true;
  if (v === "admin") return false;
  return bucket(m?.id) < Math.min(100, +v || 0);
}
export const lockLabel = (v) => (!v || v === "off" ? "ปิด (ทุกคนเห็นท็อป 1–5 ตามเดิม)" : v === "admin" ? "ทดสอบเฉพาะแอดมิน (\"ดูแบบ free\")" : `เปิด ${v}% ของผู้ใช้ Free`);

// One member's view: Pro or not (admins can preview Free with "ดูแบบ free"), and whether category tops are locked.
export async function viewOf(m, { admin = false } = {}) {
  const preview = admin && !!m?.viewAsFree;
  const pro = isPro(m) && !preview;
  return { pro, lockCat: !pro && lockTop5For(await flags(), m, { adminPreview: preview }) };
}

// Teaser rows for a locked block.
export const lockRows = (items) => items.map((p, i) => ({ rank: i + 1, image: p.image || "", category: p.category || "", perOrder: Math.round(p._perOrder || 0) }));

// Card-safe copy of a ranked product: no owner link/sub-id, but keeps the scores the cards show.
export const forCard = (p) => ({ ...publicProduct(p), _t: p._t, _a: p._a, _perOrder: p._perOrder, ...(p._perDay != null ? { _perDay: p._perDay, _boost: p._boost } : {}) });

const categories = (all) => [...new Set(all.map((p) => p.category).filter(Boolean))];

// The shared catalog for one view.
// Pro: every product. Free: FREE_PER_CAT per category, starting after LOCK_N when lockCat.
// `lockedIds` stays on the server so searches can't surface the locked products.
export async function sharedCatalog({ pro, lockCat }) {
  const all = await ownerProducts();
  const products = {}, locked = {}, lockedIds = new Set();
  for (const c of categories(all)) {
    const r = rank(all.filter((p) => p.category === c));
    if (pro) { r.forEach((p) => { products[p.id] = publicProduct(p); }); continue; }
    const start = lockCat ? LOCK_N : 0;
    r.slice(start, start + FREE_PER_CAT).forEach((p, i) => { products[p.id] = { ...publicProduct(p), _rank: start + i + 1 }; });
    if (lockCat) {
      const top = r.slice(0, LOCK_N);
      top.forEach((p) => lockedIds.add(p.id));
      locked[c] = lockRows(top);
    }
  }
  return { products, locked, lockedIds };
}

// ท็อปรวมวันนี้: the #1 of every category, best first. Pro ranks its own products (`own`, e.g. its scans).
export async function topAll({ pro, own }) {
  const mine = pro && own?.length > 0;
  const src = mine ? own : await ownerProducts();
  const firsts = categories(src).map((c) => rank(src.filter((p) => p.category === c))[0]).filter(Boolean).sort((a, b) => b._t - a._t).slice(0, TOP_ALL_N);
  const n = pro ? 0 : Math.min(LOCK_N, firsts.length);
  return { locked: lockRows(firsts.slice(0, n)), items: firsts.slice(n).map((p, i) => ({ ...(mine ? p : forCard(p)), _n: n + i + 1 })), cats: categories(src) };
}

// มาแรงวันนี้: products selling faster than their own 30-day average, across categories.
export async function hotView({ pro, proShow = 10 }) {
  const { items, since } = await trending(await ownerProducts(), 20);
  const n = pro ? 0 : Math.min(LOCK_N, items.length);
  const shown = items.slice(n, n + (pro ? proShow : FREE_HOT));
  return { since, locked: lockRows(items.slice(0, n)), items: shown.map((p, i) => ({ ...forCard(p), _n: n + i + 1 })), more: items.length - n - shown.length };
}
