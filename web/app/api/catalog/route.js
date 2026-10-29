// Shared catalog for the web app. What each member gets is decided in lib/access.js.
import { requireMember } from "../../../lib/auth";
import { viewOf, sharedCatalog } from "../../../lib/access";
import { addViews } from "../../../lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const view = await viewOf(member);
  const { products, locked } = await sharedCatalog(view);
  addViews(Object.keys(products).length).catch(() => {});
  return Response.json({ products, ...(view.lockCat ? { locked } : {}) });
}
