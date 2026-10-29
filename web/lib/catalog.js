// Shared catalog: the owner's latest scanned products, ranked per category.
// Who may see which part of it: lib/access.js.
import { roster } from "./auth";
import { readJSON } from "./store";

export async function ownerProducts() {
  const r = await roster();
  const owner = r.admins[0];
  const state = owner ? await readJSON(`users/m_${owner}.json`) : null;
  return Object.values(state?.products || {});
}

// strip owner-only fields for members
export const publicProduct = ({ affLink, linkAt, subId, _d, _a, _t, _perOrder, ...p }) => p;
