// Shared catalog: Free gets top 5 per category (or ranks 6–10 + locked teasers while the lock test is on),
// Pro without own scans gets everything. Never the owner's affiliate links.
import { requireMember } from "../../../lib/auth";
import { catalog, freeCatalog, publicProduct } from "../../../lib/catalog";
import { isPro } from "../../../lib/plan";
import { flags, lockTop5For } from "../../../lib/flags";
import { addViews } from "../../../lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  if (isPro(member)) {
    const products = {};
    for (const list of Object.values(await catalog(Infinity))) for (const p of list) products[p.id] = publicProduct(p);
    addViews(Object.keys(products).length).catch(() => {});
    return Response.json({ products });
  }
  const lock = lockTop5For(await flags(), member);
  const { products, locked } = await freeCatalog(lock);
  addViews(Object.keys(products).length).catch(() => {});
  return Response.json({ products, ...(lock ? { locked } : {}) });
}
