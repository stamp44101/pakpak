// Shared catalog: the owner's latest scanned products, ranked per category.
// Who may see which part of it: lib/access.js.
import { roster } from "./auth";
import { readCached } from "./store";

// The owner's products are ~1 MB+. readCached() keeps them per function instance and re-downloads them only
// when the owner's document changed (it checks the row version once a minute).
let memo = { src: null, list: [] };

export async function ownerProducts() {
  const r = await roster();
  const owner = r.admins[0];
  const products = owner ? await readCached(`users/m_${owner}.json`, "products") : null;
  if (memo.src !== products) memo = { src: products, list: Object.values(products || {}) };
  return memo.list;
}

// strip owner-only fields for members
export const publicProduct = ({ affLink, linkAt, subId, _d, _a, _t, _perOrder, ...p }) => p;
