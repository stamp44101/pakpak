// Shared catalog: the owner's latest scanned products, ranked per category.
// Free members browse this (top N per category, product pages only — never the owner's affiliate links).
import { roster } from "./auth";
import { readJSON } from "./store";
import { rank } from "./score";

export async function ownerProducts() {
  const r = await roster();
  const owner = r.admins[0];
  const state = owner ? await readJSON(`users/m_${owner}.json`) : null;
  return Object.values(state?.products || {});
}

// { category: [ranked products...] }
export async function catalog(topPerCat = 5) {
  const all = await ownerProducts();
  const out = {};
  for (const c of new Set(all.map((p) => p.category).filter(Boolean))) out[c] = rank(all.filter((p) => p.category === c)).slice(0, topPerCat);
  return out;
}

// What a Free member gets. With `lock`, ranks 1–5 of each category are only teasers
// (image to blur + ≈฿/order, no name/link/id) and ranks 6–10 are shown instead.
// lockedIds stays on the server (used to keep searches from leaking the locked products).
export const LOCKED_N = 5;
export async function freeCatalog(lock) {
  const all = await ownerProducts();
  const products = {}, locked = {}, lockedIds = new Set();
  for (const c of new Set(all.map((p) => p.category).filter(Boolean))) {
    const r = rank(all.filter((p) => p.category === c));
    const start = lock ? LOCKED_N : 0;
    r.slice(start, start + 5).forEach((p, i) => { products[p.id] = { ...publicProduct(p), _rank: start + i + 1 }; });
    if (lock) {
      const top = r.slice(0, LOCKED_N);
      top.forEach((p) => lockedIds.add(p.id));
      locked[c] = top.map((p, i) => ({ rank: i + 1, image: p.image || "", perOrder: Math.round(p._perOrder || 0) }));
    }
  }
  return { products, locked, lockedIds };
}

// strip owner-only fields for members
export const publicProduct = ({ affLink, linkAt, subId, _d, _a, _t, _perOrder, ...p }) => p;
