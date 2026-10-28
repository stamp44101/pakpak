// One-time: the owner claims admin on a fresh database (after the 28 Oct 2026 move).
// Needs a signed-in session + the one-time token (only its SHA-256 is stored here); only works while the roster has no admins.
import { createHash } from "crypto";
import { readSession, getMember, saveMember, mutateRoster } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CLAIM_HASH = "9f937b408b0e0d0a226d1037e42b92b3a1cb2ac0a4572035bb02d1bec55264af";

export async function GET(req) {
  const s = readSession(req);
  const token = new URL(req.url).searchParams.get("token");
  const ok = token && createHash("sha256").update(token).digest("hex") === CLAIM_HASH;
  if (!s || !ok) return Response.json({ error: "forbidden" }, { status: 403 });
  let taken = false;
  await mutateRoster((r) => {
    taken = r.admins.length > 0 && r.admins[0] !== s.sub;
    if (taken) return;
    r.admins = [s.sub, ...r.admins.filter((x) => x !== s.sub)];
    if (!r.active.includes(s.sub)) r.active.push(s.sub);
  });
  if (taken) return Response.json({ error: "already claimed" }, { status: 409 });
  let m = (await getMember(s.sub)) || { id: s.sub, name: "สมาชิก", picture: "", status: "active", joinedAt: Date.now(), ai: { day: "", count: 0 } };
  m.plan = "pro"; m.proUntil = null; m.legacyChecked = true;
  await saveMember(m);
  return Response.redirect(new URL("/admin", req.url), 302);
}
