// Trend Alert collections (lib/collections.js). Pro sees the products; Free only the outline — enforced here.
import { requireMember, isAdmin } from "../../../lib/auth";
import { collectionView } from "../../../lib/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const v = collectionView(new URL(req.url).searchParams.get("slug") || "", member, { admin: await isAdmin(member.id) });
  if (!v) return Response.json({ error: "ไม่พบคอลเลกชันนี้" }, { status: 404 });
  return Response.json(v);
}
