// Per-member saved state (products, scores, links), synced across devices.
import { readJSON, writeJSON } from "../../../lib/store";
import { requireMember } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const path = (m) => `users/m_${m.id}.json`;

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const state = await readJSON(path(member));
  return Response.json(state || { products: {}, updatedAt: 0 });
}

export async function PUT(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (body && body.products === undefined && typeof body.account === "string") {
    // Shopee Affiliate account name seen by the Connector
    const cur = (await readJSON(path(member))) || { products: {}, updatedAt: 0 };
    if (cur.account !== body.account) await writeJSON(path(member), { ...cur, account: body.account.slice(0, 80) });
    return Response.json({ ok: true, updatedAt: cur.updatedAt });
  }
  if (!body || typeof body.products !== "object") return Response.json({ error: "bad body" }, { status: 400 });
  if (JSON.stringify(body.products).length > 3_000_000) return Response.json({ error: "too large" }, { status: 413 });
  const cur = (await readJSON(path(member))) || {};
  const state = { products: body.products, account: body.account || cur.account || null, updatedAt: Date.now() };
  await writeJSON(path(member), state);
  return Response.json({ ok: true, updatedAt: state.updatedAt });
}
