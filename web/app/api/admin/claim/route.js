// One-time: the owner claims admin on a fresh database (after the 28 Oct 2026 move).
// Needs a signed-in session + the one-time token; only works while the roster has no admins.
// The token's SHA-256 comes from env ADMIN_CLAIM_HASH. Unset (the normal state) = this route is off.
// It used to be written in this file, in a public repo: to claim a fresh database again, make a new long random
// token, set ADMIN_CLAIM_HASH to its SHA-256 (hex) in Vercel, open /api/admin/claim?token=…, then remove the env.
import { createHash } from "crypto";
import { readSession, getMember, saveMember, mutateRoster } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const s = readSession(req);
  const token = new URL(req.url).searchParams.get("token");
  const want = (process.env.ADMIN_CLAIM_HASH || "").trim().toLowerCase();
  const ok = /^[a-f0-9]{64}$/.test(want) && token && createHash("sha256").update(token).digest("hex") === want;
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
