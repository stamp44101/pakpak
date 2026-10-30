// Admin: list members, activate / move to waitlist / revoke.
import { requireMember, isAdmin, roster, mutateRoster, getMember, saveMember, memberPath, seats, earlyTaken, openFree } from "../../../lib/auth";
import { planInfo, isPro, grantPro, makeAdminPro, orderOf, ORDERS, EA_DAYS, PROMO_HOURS, promoLive } from "../../../lib/plan";
import { offerCard } from "../../../lib/bot/ui";
import { thDate } from "../../../lib/fmt";
import { push, quota, markPushed } from "../../../lib/line";
import { readJSON, updateJSON } from "../../../lib/store";
import { freeWelcome } from "../../../lib/welcome";
import { freeRulesNow } from "../../../lib/access";
import { notifyDiscord, notifyError } from "../../../lib/discord";
import { ANNOUNCE } from "../../../lib/announce";
import { loadCampaigns, grant, grantsOf, freeDaysOf, isLive, messageFor, FREE_DAYS_CAP } from "../../../lib/campaigns";
import { allMembers, membersOf } from "../../../lib/members";

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
  const t0 = Date.now();
  const g = await guard(req);
  if (g.error) return g.error;
  const t1 = Date.now();
  const r = await roster();
  const t2 = Date.now();
  // Everything that doesn't depend on the members runs alongside the big read.
  const [all, campaigns, req0, qt, tm] = await Promise.all([allMembers(r).then((x) => [x, Date.now()]), loadCampaigns(), readJSON("meta/requests.json"), quota()]).then(([[a, t], c, q0, q]) => [a, c, q0 || {}, q, t]);
  const members = all.map((m) => ({
    id: m.id, name: m.name, picture: m.picture, status: m.status, joinedAt: m.joinedAt, admin: r.admins.includes(m.id), owner: r.admins[0] === m.id, aiToday: m.ai?.count || 0, aiDay: m.ai?.day || "", onboarding: m.onboarding?.done || [], ...planInfo(m), pendingOrder: m.pendingOrder || null, freeSince: m.freeSince || null, welcomeFree: !!m.welcomeFree, welcomePushedAt: m.welcomePushedAt || null, trialAt: m.trialAt || null, grants: grantsOf(m), freeDays: freeDaysOf(m), founding: !!m.founding, foundingOffer: !!m.foundingOffer, promo: m.promo || null, promoLive: promoLive(m),
    payments: m.payments || [], webPromo: m.webPromo || null,
  }));
  const announce = Object.entries(ANNOUNCE).map(([key, a]) => {
    const target = all.filter((m) => a.to(m, r.admins));
    return { key, label: a.label, left: target.filter((m) => !m.news?.[key]).length, sent: target.filter((m) => m.news?.[key]).length };
  });
  const toWelcome = members.filter((m) => m.status === "active" && m.plan !== "pro" && m.welcomeFree && !m.welcomePushedAt).length;
  const requests = Object.entries(req0).map(([kw, x]) => ({ kw, count: x.count, people: x.users?.length || 0, last: x.last })).sort((a, b) => b.people - a.people || b.count - a.count).slice(0, 20);
  return Response.json({ members, campaigns: Object.values(campaigns).filter((c) => isLive(c)).map((c) => ({ key: c.key, label: c.label, days: c.days, who: c.who, perMember: c.perMember, proof: c.proof || "" })), freeDaysCap: FREE_DAYS_CAP, seats: seats(), active: earlyTaken(r), toWelcome, requests, announce, quota: qt }, { headers: { "Server-Timing": `auth;dur=${t1 - t0}, roster;dur=${t2 - t1}, members;dur=${tm - t2}, total;dur=${Date.now() - t0}` } });
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
  const { id, ids: offerIds, announce, status, plan, days, approve, reject, welcomeFree, admin, grant: grantKey, cancelOrder, founding } = (await req.json().catch(() => ({}))) || {};
  // One-time LINE push to everyone moved from the waitlist to Free who hasn't been told yet.
  if (welcomeFree) {
    const r0 = await roster();
    const est = (await membersOf(r0.active)).filter((w) => w && w.welcomeFree && !w.welcomePushedAt && w.plan !== "pro").length + r0.waitlist.length;
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
    const targets = (await membersOf(r.active)).filter((w) => w && a.to(w, r.admins) && !w.news?.[announce]);
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
  // Chose a plan but never sent a slip: an admin can drop it before the 24h expiry. Kept as orderExpired, so a
  // slip that still arrives within 7 days revives the order (same path as the automatic expiry, see webhook).
  if (cancelOrder) {
    let had = null;
    const saved = await updateJSON(memberPath(m.id), (cur) => {
      had = cur.pendingOrder;
      if (!had || had.slipAt) return cur;
      cur.orderExpired = { plan: had.plan, at: had.at, expiredAt: Date.now(), cancelledBy: g.member.name };
      cur.pendingOrder = null;
      return cur;
    }, () => m);
    if (!had) return Response.json({ error: "ไม่มีคำสั่งซื้อที่รอสลิป" }, { status: 400 });
    if (had.slipAt) return Response.json({ error: `${m.name} ส่งสลิปมาแล้ว ให้ตรวจแล้วกดอนุมัติหรือสลิปไม่ผ่านแทน` }, { status: 400 });
    Object.assign(m, saved);
    return Response.json({ ok: true });
  }
  if (approve || reject) {
    // Version-checked write: a slip or plan tap landing at the same moment can't wipe the approval (or vice versa).
    let order, o;
    const saved = await updateJSON(memberPath(m.id), (cur) => {
      order = cur.pendingOrder; o = orderOf(order?.plan);
      if (!order) return cur;
      cur.pendingOrder = null;
      if (approve) {
        grantPro(cur, o.days);
        if (o.founding) cur.founding = true; // keeps the founding price on renewals
        if (o.founding && cur.promo && !cur.promo.paidAt) cur.promo.paidAt = Date.now();
        cur.payments = [...(cur.payments || []), { plan: order.plan, amount: o.price, at: Date.now(), by: g.member.name }];
      }
      return cur;
    }, () => m);
    if (!order) return Response.json({ error: "ไม่มีคำสั่งซื้อที่รอตรวจ" }, { status: 400 });
    Object.assign(m, saved);
    if (approve && m.status !== "active") {
      await mutateRoster((r) => { for (const k of ["active", "waitlist", "revoked"]) r[k] = (r[k] || []).filter((x) => x !== m.id); r.active.push(m.id); });
      m.status = "active";
      await updateJSON(memberPath(m.id), (cur) => ({ ...cur, status: "active" }), () => m);
    }
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
  // Campaign grant (see lib/campaigns.js): Pro days for an admin-checked activity, rules live in the campaign.
  if (grantKey) {
    const c = (await loadCampaigns())[grantKey];
    const { err, wasPro, member } = await grant(memberPath(m.id), m, c, g.member.name);
    if (err) return Response.json({ error: err }, { status: 400 });
    Object.assign(m, member);
    notifyDiscord("trial", { title: `🎁 ${c.label} → Pro +${c.days} วัน`, lines: [`**${m.name}** · ${wasPro ? "Pro ต่ออายุ" : "Free → Pro"} ถึง ${thDate(m.proUntil)} · โดย ${g.member.name}`] }).catch(() => {});
    await push(m.id, { type: "text", text: messageFor(c, m) }).catch(() => {});
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
