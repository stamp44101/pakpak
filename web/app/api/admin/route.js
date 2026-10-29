// Admin: list members, activate / move to waitlist / revoke.
import { requireMember, isAdmin, roster, mutateRoster, getMember, saveMember, seats, earlyTaken, openFree } from "../../../lib/auth";
import { planInfo, grantPro, makeAdminPro, orderOf, ORDERS, EA_DAYS, ADMIN_TRIAL_DAYS, PROMO_HOURS, promoLive } from "../../../lib/plan";
import { offerCard } from "../../../lib/bot/ui";
import { thDate } from "../../../lib/fmt";
import { push, quota, markPushed } from "../../../lib/line";
import { readJSON } from "../../../lib/store";
import { freeWelcome } from "../../../lib/welcome";
import { freeRulesNow } from "../../../lib/access";
import { notifyDiscord, notifyError } from "../../../lib/discord";
import { ANNOUNCE } from "../../../lib/announce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // group pushes (announce, ฿99 offer) go one member at a time

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
  const all = (await Promise.all(ids.map(getMember))).filter(Boolean);
  const members = all.map((m) => ({
    id: m.id, name: m.name, picture: m.picture, status: m.status, joinedAt: m.joinedAt, admin: r.admins.includes(m.id), owner: r.admins[0] === m.id, aiToday: m.ai?.count || 0, aiDay: m.ai?.day || "", onboarding: m.onboarding?.done || [], ...planInfo(m), pendingOrder: m.pendingOrder || null, freeSince: m.freeSince || null, welcomeFree: !!m.welcomeFree, welcomePushedAt: m.welcomePushedAt || null, trialAt: m.trialAt || null, founding: !!m.founding, foundingOffer: !!m.foundingOffer, promo: m.promo || null, promoLive: promoLive(m),
  }));
  const announce = Object.entries(ANNOUNCE).map(([key, a]) => {
    const target = all.filter((m) => a.to(m, r.admins));
    return { key, label: a.label, left: target.filter((m) => !m.news?.[key]).length, sent: target.filter((m) => m.news?.[key]).length };
  });
  const toWelcome = members.filter((m) => m.status === "active" && m.plan !== "pro" && m.welcomeFree && !m.welcomePushedAt).length;
  const req0 = (await readJSON("meta/requests.json")) || {};
  const requests = Object.entries(req0).map(([kw, x]) => ({ kw, count: x.count, people: x.users?.length || 0, last: x.last })).sort((a, b) => b.people - a.people || b.count - a.count).slice(0, 20);
  return Response.json({ members, seats: seats(), active: earlyTaken(r), toWelcome, requests, announce, quota: await quota() });
}

// Group pushes stop before they start if the month's push quota can't cover them.
// RESERVE keeps room for the one-off pushes that matter most (Pro approved, slip alerts to admins).
const RESERVE = 20;
async function quotaBlock(n, what) {
  if (n <= 0) return null;
  const qt = await quota({ fresh: true });
  if (!qt) { notifyError("⚠️ อ่านโควตา push ไม่ได้", [`กำลังส่ง ${what} ${n} คน — ส่งต่อโดยไม่เช็ก`]).catch(() => {}); return null; }
  if (qt.left == null || qt.left >= n + RESERVE) return null;
  return Response.json({ error: `โควตา push เหลือ ${qt.left} ข้อความ (ใช้ไป ${qt.used}/${qt.value} เดือนนี้) ไม่พอส่ง ${what} ${n} คน + สำรอง ${RESERVE} สำหรับแจ้งอนุมัติ Pro`, quota: qt }, { status: 409 });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.error) return g.error;
  const { id, ids: offerIds, announce, status, plan, days, approve, reject, welcomeFree, admin, trial, founding } = (await req.json().catch(() => ({}))) || {};
  // One-time LINE push to everyone moved from the waitlist to Free who hasn't been told yet.
  if (welcomeFree) {
    const r0 = await roster();
    const est = (await Promise.all(r0.active.map(getMember))).filter((w) => w && w.welcomeFree && !w.welcomePushedAt && w.plan !== "pro").length + r0.waitlist.length;
    const blocked = await quotaBlock(est, "แจ้งคน Free");
    if (blocked) return blocked;
    const r = await roster();
    for (const wid of [...r.waitlist]) { const w = await getMember(wid); if (w && w.status === "waitlist") await openFree(w); }
    const ids = (await roster()).active, rules = await freeRulesNow();
    let sent = 0;
    for (const mid of ids) {
      const w = await getMember(mid);
      if (!w || !w.welcomeFree || w.welcomePushedAt || w.plan === "pro") continue;
      try { if (await push(w.id, freeWelcome(w, rules))) { w.welcomePushedAt = Date.now(); await saveMember(w); sent++; } } catch {}
    }
    markPushed(sent);
    return Response.json({ ok: true, sent });
  }
  // One-time announcement (lib/announce.js) to its target group; each member gets it once.
  if (announce) {
    const a = ANNOUNCE[announce];
    if (!a) return Response.json({ error: "ไม่พบประกาศนี้" }, { status: 400 });
    const r = await roster();
    const targets = (await Promise.all(r.active.map(getMember))).filter((w) => w && a.to(w, r.admins) && !w.news?.[announce]);
    const blocked = await quotaBlock(targets.length, `"${a.label}"`);
    if (blocked) return blocked;
    let sent = 0, failed = 0;
    for (const mid of targets.map((w) => w.id)) {
      const w = await getMember(mid);
      if (!w || !a.to(w, r.admins) || w.news?.[announce]) continue;
      if (await push(w.id, a.message(w))) { w.news = { ...(w.news || {}), [announce]: Date.now() }; await saveMember(w); sent++; } else failed++;
    }
    markPushed(sent);
    notifyDiscord("trial", { title: `📣 ${a.label}`, lines: [`ส่ง ${sent} คน${failed ? ` · ไม่สำเร็จ ${failed}` : ""} · โดย ${g.member.name}`] }).catch(() => {});
    return Response.json({ ok: true, sent, failed });
  }
  // ฿99 promo to a group the admin picked in /admin (e.g. the "สนใจ Pro" filter). Skips anyone who can't or needn't get it.
  if (Array.isArray(offerIds)) {
    const blocked = await quotaBlock(Math.min(offerIds.length, 200), `ข้อเสนอ ฿${ORDERS.fmonth.price}`);
    if (blocked) return blocked;
    const r = await roster();
    let sent = 0, skipped = 0;
    for (const oid of offerIds.slice(0, 200)) {
      const w = await getMember(String(oid));
      if (!w || w.status !== "active" || r.admins.includes(w.id) || w.founding || promoLive(w)) { skipped++; continue; }
      try { await sendOffer(w, g.member); sent++; } catch { skipped++; }
    }
    markPushed(sent);
    notifyDiscord("trial", { title: `🎁 ส่งข้อเสนอ ฿${ORDERS.fmonth.price} ทั้งกลุ่ม`, lines: [`ส่ง ${sent} คน · ข้าม ${skipped} คน · โดย ${g.member.name}`] }).catch(() => {});
    return Response.json({ ok: true, sent, skipped });
  }
  const m = await getMember(String(id || ""));
  if (!m) return Response.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  if (approve || reject) {
    const order = m.pendingOrder, o = orderOf(order?.plan);
    if (!order) return Response.json({ error: "ไม่มีคำสั่งซื้อที่รอตรวจ" }, { status: 400 });
    m.pendingOrder = null;
    if (approve) {
      grantPro(m, o.days);
      if (o.founding) m.founding = true; // keeps the founding price on renewals
      if (o.founding && m.promo && !m.promo.paidAt) m.promo.paidAt = Date.now();
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
  // Founding price, offered one member at a time: their buy card then shows ฿99/฿990, with a LINE push when offered.
  if (founding !== undefined) {
    if (m.founding && !founding) return Response.json({ error: `${m.name} ซื้อราคา Founding ไปแล้ว ยกเลิกไม่ได้` }, { status: 400 });
    if (founding) {
      try { await sendOffer(m, g.member); } catch { return Response.json({ error: `ส่ง LINE ให้ ${m.name} ไม่สำเร็จ (โควตา push หมด หรือถูกบล็อก)` }, { status: 502 }); }
      notifyDiscord("trial", { title: `🎁 เสนอราคา ฿${ORDERS.fmonth.price}`, lines: [`**${m.name}** · โดย ${g.member.name}`] }).catch(() => {});
    } else {
      m.foundingOffer = false;
      if (m.promo) m.promo.cancelledAt = Date.now();
      await saveMember(m);
    }
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

// Open the ฿99 window for PROMO_HOURS and push the offer card; its buttons take over from there (webhook a=promo).
async function sendOffer(m, by) {
  m.foundingOffer = true;
  m.promo = { at: Date.now(), until: Date.now() + PROMO_HOURS * 36e5, by: by.name };
  if (!(await push(m.id, offerCard(m)))) throw new Error("push failed"); // push first: nothing is saved if LINE refuses (quota, blocked)
  await saveMember(m);
}
