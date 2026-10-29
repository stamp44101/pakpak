// "มาแรงวันนี้" for the web app. Free/Pro rules: lib/access.js (hotView). Never the owner's affiliate links.
import { requireMember } from "../../../lib/auth";
import { viewOf, hotView } from "../../../lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const { since, locked, items, more } = await hotView({ ...(await viewOf(member)), proShow: 20 });
  return Response.json({
    since, more, locked,
    items: items.map(({ _t, _a, _perOrder, _perDay, _boost, _n, ...p }) => ({ ...p, rank: _n, perDay: Math.round(_perDay), boost: +_boost.toFixed(1), perOrder: Math.round(_perOrder) })),
  });
}
