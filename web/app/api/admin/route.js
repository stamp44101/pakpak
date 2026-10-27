// Admin: list members, activate / move to waitlist / revoke.
import { requireMember, isAdmin, roster, saveRoster, getMember, saveMember, seats } from "../../../lib/auth";
import { planInfo, grantPro, TRIAL_DAYS } from "../../../lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard(req) {
  const { member, error } = await requireMember(req);
  if (error) return { error };
  if (!(await isAdmin(member.id))) return { error: Response.json({ error: "สำหรับผู้ดูแลเท่านั้น" }, { status: 403 }) };
  return { member };
}

export async function GET(req) {
  const g = await guard(req);
  if (g.error) return g.error;
  const r = await roster();
  const ids = [...r.active, ...r.waitlist, ...(r.revoked || [])];
  const members = (await Promise.all(ids.map(getMember))).filter(Boolean).map((m) => ({
    id: m.id, name: m.name, picture: m.picture, status: m.status, joinedAt: m.joinedAt, admin: r.admins.includes(m.id), aiToday: m.ai?.count || 0, aiDay: m.ai?.day || "", onboarding: m.onboarding?.done || [], ...planInfo(m),
  }));
  return Response.json({ members, seats: seats(), active: r.active.length });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.error) return g.error;
  const { id, status, plan, days } = (await req.json().catch(() => ({}))) || {};
  const m = await getMember(String(id || ""));
  if (!m) return Response.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  if (plan) {
    if (plan === "pro") grantPro(m, days === null ? null : Number(days) || 30);
    else if (plan === "free") { m.plan = "free"; m.proUntil = null; }
    else return Response.json({ error: "แพ็กไม่ถูกต้อง" }, { status: 400 });
    await saveMember(m);
    return Response.json({ ok: true });
  }
  if (!["active", "waitlist", "revoked"].includes(status)) return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  const r = await roster();
  r.revoked = r.revoked || [];
  for (const k of ["active", "waitlist", "revoked"]) r[k] = r[k].filter((x) => x !== m.id);
  r[status].push(m.id);
  m.status = status;
  if (status === "active" && m.plan === undefined) grantPro(m, TRIAL_DAYS, { early: true });
  await saveRoster(r); await saveMember(m);
  return Response.json({ ok: true });
}
