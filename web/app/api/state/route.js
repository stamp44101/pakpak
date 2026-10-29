// Per-member saved state (products, scores, links), synced across devices.
import { readJSON, writeJSON } from "../../../lib/store";
import { requireMember } from "../../../lib/auth";
import { isPro } from "../../../lib/plan";
import { roster } from "../../../lib/auth";
import { recordSold } from "../../../lib/trending";

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
  if (body && body.products === undefined && (typeof body.account === "string" || typeof body.live === "boolean")) {
    // Shopee Affiliate session as seen by the Connector on the member's computer, so phones can show it too
    const cur = (await readJSON(path(member))) || { products: {}, updatedAt: 0 };
    const next = { ...cur, shopeeSeenAt: Date.now() };
    if (typeof body.account === "string" && body.account) next.account = body.account.slice(0, 80);
    if (typeof body.live === "boolean") next.shopeeLive = body.live;
    await writeJSON(path(member), next);
    return Response.json({ ok: true, updatedAt: cur.updatedAt });
  }
  if (!body || typeof body.products !== "object") return Response.json({ error: "bad body" }, { status: 400 });
  if (!isPro(member)) return Response.json({ error: "บันทึกสินค้าที่สแกนเองได้ในแพ็ก Pro", upgrade: true }, { status: 403 });
  if (JSON.stringify(body.products).length > 3_000_000) return Response.json({ error: "too large" }, { status: 413 });
  const cur = (await readJSON(path(member))) || {};
  const state = { ...cur, products: body.products, account: body.account || cur.account || null, updatedAt: Date.now() };
  await writeJSON(path(member), state);
  // the owner's scans are the shared catalog: keep a daily sales snapshot for "มาแรงวันนี้"
  if ((await roster()).admins[0] === member.id) await recordSold(body.products).catch((e) => console.error("recordSold", e));
  return Response.json({ ok: true, updatedAt: state.updatedAt });
}
