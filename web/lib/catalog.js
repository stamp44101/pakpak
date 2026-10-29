// Shared catalog: the owner's latest scanned products, ranked per category.
// Who may see which part of it: lib/access.js.
import { roster } from "./auth";
import { readJSON } from "./store";

// Cached per function instance for a minute: the owner's state is ~1 MB and used to be pulled
// from Postgres on every bot message / catalog view (Neon network transfer ~2 GB/day).
const TTL = 60_000;
let cache = { at: 0, list: null, pending: null };

export async function ownerProducts() {
  if (cache.list && Date.now() - cache.at < TTL) return cache.list;
  if (cache.pending) return cache.pending;
  cache.pending = (async () => {
    const r = await roster();
    const owner = r.admins[0];
    const products = owner ? await readJSON(`users/m_${owner}.json`, "products") : null;
    const list = Object.values(products || {});
    cache = { at: Date.now(), list, pending: null };
    return list;
  })().catch((e) => { cache.pending = null; throw e; });
  return cache.pending;
}

// strip owner-only fields for members
export const publicProduct = ({ affLink, linkAt, subId, _d, _a, _t, _perOrder, ...p }) => p;
