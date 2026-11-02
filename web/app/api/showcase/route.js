// Public demo data for the landing page: the owner's real ranked products, shown the way Free sees them
// (top LOCK_N per category locked, see lib/showcase.js). Product facts + the owner's own affiliate links only.
import { ownerProducts } from "../../../lib/catalog";
import { LOCK_N } from "../../../lib/access";
import { showcase } from "../../../lib/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const categories = showcase(await ownerProducts(), { lockN: LOCK_N });
  return Response.json({ categories }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=86400" } });
}
