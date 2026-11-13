// Per-member saved state (products, scores, links), synced across devices.
import { readJSON, patchJSON } from "../../../lib/store";
import { requireMember } from "../../../lib/auth";
import { isPro } from "../../../lib/plan";
import { roster } from "../../../lib/auth";
import { recordSold } from "../../../lib/trending";
import { isSharedCopy } from "../../../lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const path = (m) => `users/m_${m.id}.json`;

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const state = await readJSON(path(member));
  // a copy of the shared catalog saved by an old bug is not the member's own data
  if (isSharedCopy(state)) return Response.json({ products: {}, updatedAt: 0 });
  return Response.json(state || { products: {}, updatedAt: 0 });
}

export async function PUT(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (body && body.products === undefined && (typeof body.account === "string" || typeof body.live === "boolean")) {
    // Shopee Affiliate session as seen by the Connector on the member's computer, so phones can show it too
    // merged inside Postgres: this runs every 10 minutes per open tab and used to pull the whole document (owner: ~1 MB+) each time
    const patch = { shopeeSeenAt: Date.now() };
    if (typeof body.account === "string" && body.account) patch.account = body.account.slice(0, 80);
    if (typeof body.live === "boolean") patch.shopeeLive = body.live;
    const updatedAt = await patchJSON(path(member), patch, { init: { products: {}, updatedAt: 0 }, touch: false });
    return Response.json({ ok: true, updatedAt: updatedAt || 0 });
  }
  if (!body || typeof body.products !== "object") return Response.json({ error: "bad body" }, { status: 400 });
  if (!isPro(member)) return Response.json({ error: "บันทึกสินค้าที่สแกนเองได้ในแพ็ก Pro", upgrade: true }, { status: 403 });
  if (JSON.stringify(body.products).length > 3_000_000) return Response.json({ error: "too large" }, { status: 413 });
  // real scans replace any shared copy an old bug left here. Merged inside Postgres: reading the old document back
  // on every save (each scan saves many times) was a large part of the database's network transfer.
  const updatedAt = Date.now();
  await patchJSON(path(member), { products: body.products, ...(body.account ? { account: body.account } : {}), updatedAt }, { init: { account: null }, drop: ["shared", "locked", "lockedIds"] });
  // the owner's scans are the shared catalog: keep a daily sales snapshot for "มาแรงวันนี้"
  if ((await roster()).admins[0] === member.id) await recordSold(body.products).catch((e) => console.error("recordSold", e));
  return Response.json({ ok: true, updatedAt });
}
