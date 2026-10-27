// Shared catalog for Free members (top 5 per category, no affiliate links).
import { requireMember } from "../../../lib/auth";
import { catalog, publicProduct } from "../../../lib/catalog";
import { limits } from "../../../lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const cat = await catalog(limits(member).topPerCat || 40);
  const products = {};
  for (const list of Object.values(cat)) for (const p of list) products[p.id] = publicProduct(p);
  return Response.json({ products });
}
