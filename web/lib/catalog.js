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

// strip owner-only fields for members
export const publicProduct = ({ affLink, linkAt, subId, _d, _a, _t, _perOrder, ...p }) => p;
