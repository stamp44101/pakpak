// Per-user saved state (products, picks, links, clip results), synced across devices.
import { readJSON, writeJSON, userKey, unauthorized } from "../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const u = userKey(req);
  if (!u) return unauthorized();
  const state = await readJSON(`users/${u.id}.json`);
  return Response.json(state || { products: {}, updatedAt: 0 });
}

export async function PUT(req) {
  const u = userKey(req);
  if (!u) return unauthorized();
  const body = await req.json().catch(() => null);
  if (body && body.products === undefined && typeof body.account === "string") {
    // account-name-only update (sent by the Connector device when it sees who is logged in)
    const cur = (await readJSON(`users/${u.id}.json`)) || { products: {}, updatedAt: 0 };
    if (cur.account !== body.account) await writeJSON(`users/${u.id}.json`, { ...cur, account: body.account.slice(0, 80) });
    return Response.json({ ok: true, updatedAt: cur.updatedAt });
  }
  if (!body || typeof body.products !== "object") return Response.json({ error: "bad body" }, { status: 400 });
  const text = JSON.stringify(body.products);
  if (text.length > 3_000_000) return Response.json({ error: "too large" }, { status: 413 });
  const state = { products: body.products, account: body.account || null, updatedAt: Date.now() };
  await writeJSON(`users/${u.id}.json`, state);
  return Response.json({ ok: true, updatedAt: state.updatedAt });
}
