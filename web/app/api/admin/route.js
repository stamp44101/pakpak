// Admin: list members, activate / move to waitlist / revoke.
import { requireMember, isAdmin, roster, mutateRoster, getMember, saveMember, seats, earlyTaken, openFree } from "../../../lib/auth";
import { planInfo, grantPro, makeAdminPro, orderOf, EA_DAYS, ADMIN_TRIAL_DAYS } from "../../../lib/plan";
import { thDate } from "../../../lib/fmt";
import { push } from "../../../lib/line";
import { readJSON } from "../../../lib/store";
import { freeWelcome } from "../../../lib/welcome";
import { notifyDiscord } from "../../../lib/discord";

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
    id: m.id, name: m.name, picture: m.picture, status: m.status, joinedAt: m.joinedAt, admin: r.admins.includes(m.id), owner: r.admins[0] === m.id, aiToday: m.ai?.count || 0, aiDay: m.ai?.day || "", onboarding: m.onboarding?.done || [], ...planInfo(m), pendingOrder: m.pendingOrder || null, freeSince: m.freeSince || null, welcomeFree: !!m.welcomeFree, welcomePushedAt: m.welcomePushedAt || null, trialAt: m.trialAt || null,
  }));
  const toWelcome = members.filter((m) => m.status === "active" && m.plan !== "pro" && m.welcomeFree && !m.welcomePushedAt).length;
  const req0 = (await readJSON("meta/requests.json")) || {};
  const requests = Object.entries(req0).map(([kw, x]) => ({ kw, count: x.count, people: x.users?.length || 0, last: x.last })).sort((a, b) => b.people - a.people || b.count - a.count).slice(0, 20);
  return Response.json({ members, seats: seats(), active: earlyTaken(r), toWelcome, requests });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.error) return g.error;
  const { id, status, plan, days, approve, reject, welcomeFree, admin, trial } = (await req.json().catch(() => ({}))) || {};
  // One-time LINE push to everyone moved from the waitlist to Free who hasn't been told yet.
  if (welcomeFree) {
    const r = await roster();
    for (const wid of [...r.waitlist]) { const w = await getMember(wid); if (w && w.status === "waitlist") await openFree(w); }
    const ids = (await roster()).active;
    let sent = 0;
    for (const mid of ids) {
      const w = await getMember(mid);
      if (!w || !w.welcomeFree || w.welcomePushedAt || w.plan === "pro") continue;
      try { await push(w.id, freeWelcome(w)); w.welcomePushedAt = Date.now(); await saveMember(w); sent++; } catch {}
    }
    return Response.json({ ok: true, sent });
  }
  const m = await getMember(String(id || ""));
  if (!m) return Response.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  if (approve || reject) {
    const order = m.pendingOrder, o = orderOf(order?.plan);
    if (!order) return Response.json({ error: "ไม่มีคำสั่งซื้อที่รอตรวจ" }, { status: 400 });
    m.pendingOrder = null;
    if (approve) {
      grantPro(m, o.days);
      m.payments = [...(m.payments || []), { plan: order.plan, amount: o.price, at: Date.now() }];
      if (m.status !== "active") {
        await mutateRoster((r) => { for (const k of ["active", "waitlist", "revoked"]) r[k] = (r[k] || []).filter((x) => x !== m.id); r.active.push(m.id); });
        m.status = "active";
      }
    }
    await saveMember(m);
    notifyDiscord(approve ? "approved" : "rejected", { title: approve ? `✅ อนุมัติ Pro ${o.label}` : "❌ สลิปไม่ผ่าน", lines: [`**${m.name}** · โดย ${g.member.name}`] }).catch(() => {});
    await push(m.id, { type: "text", text: approve
      ? `เปิดสิทธิ์ Pro ให้แล้ว 🎉 ใช้ได้ถึง ${thDate(m.proUntil)}\nกด "ท็อป 5 วันนี้" ที่เมนูด้านล่างเพื่อเริ่มได้เลย`
      : "สลิปยังตรวจสอบไม่ผ่าน รบกวนส่งสลิปใหม่ หรือพิมพ์รายละเอียดในแชทนี้ แอดมินจะช่วยดูให้ค่ะ" }).catch(() => {});
    return Response.json({ ok: true });
  }
  // Co-admins: same /admin access and Pro without expiry. The owner (first admin) can't be removed.
  if (admin !== undefined) {
    if ((await roster()).admins[0] === m.id) return Response.json({ error: "เปลี่ยนสิทธิ์เจ้าของไม่ได้" }, { status: 400 });
    if (m.status !== "active") return Response.json({ error: "ต้องเป็นสมาชิกที่ใช้งานอยู่" }, { status: 400 });
    await mutateRoster((r) => { r.admins = r.admins.filter((x, i) => i === 0 || x !== m.id); if (admin) r.admins.push(m.id); });
    if (admin) makeAdminPro(m);
    else { m.plan = "pro"; m.proUntil = Date.now() + EA_DAYS * 864e5; } // was Pro forever as admin: back to 30 days
    await saveMember(m);
    return Response.json({ ok: true });
  }
  // Free trial: Pro for 7 days (stacks on time left), once per member, with a LINE push.
  if (trial) {
    if (m.status !== "active") return Response.json({ error: "ต้องเป็นสมาชิกที่ใช้งานอยู่" }, { status: 400 });
    if (m.trialAt) return Response.json({ error: `${m.name} เคยได้ทดลองใช้แล้ว (${thDate(m.trialAt)})` }, { status: 400 });
    grantPro(m, ADMIN_TRIAL_DAYS);
    m.trialAt = Date.now();
    await saveMember(m);
    notifyDiscord("trial", { title: `🎁 ทดลอง Pro ${ADMIN_TRIAL_DAYS} วัน`, lines: [`**${m.name}** · โดย ${g.member.name}`] }).catch(() => {});
    await push(m.id, { type: "text", text: `🎁 แอดมินเปิดให้ทดลองใช้ Pro ฟรี ${ADMIN_TRIAL_DAYS} วัน ใช้ได้ถึง ${thDate(m.proUntil)}\nดูตะกร้าได้ทุกตัว + AI ไอเดียคลิปวันละ 30 ครั้ง\nกด "ท็อป 5 วันนี้" ที่เมนูด้านล่างเพื่อเริ่มได้เลยค่ะ` }).catch(() => {});
    return Response.json({ ok: true });
  }
  if (plan) {
    if (plan === "pro") grantPro(m, days === null ? null : Number(days) || 30);
    else if (plan === "free") { m.plan = "free"; m.proUntil = null; }
    else return Response.json({ error: "แพ็กไม่ถูกต้อง" }, { status: 400 });
    await saveMember(m);
    return Response.json({ ok: true });
  }
  if (!["active", "waitlist", "revoked"].includes(status)) return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  await mutateRoster((r) => { r.revoked ||= []; for (const k of ["active", "waitlist", "revoked"]) r[k] = r[k].filter((x) => x !== m.id); r[status].push(m.id); });
  m.status = status;
  if (status === "active" && m.plan === undefined) grantPro(m, EA_DAYS, { early: true });
  await saveMember(m);
  return Response.json({ ok: true });
}

