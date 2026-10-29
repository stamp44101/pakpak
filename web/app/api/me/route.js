// Who am I + how many Early Access seats are left.
import { readSession, getMember, ensureMember, saveMember, roster, seats, seatsLeft } from "../../../lib/auth";
import { planInfo, PRICE, ORDERS, makeAdminPro, foundingOpen } from "../../../lib/plan";
import { viewOf, countdownLine, todayCat, PAYWALL_AT } from "../../../lib/access";
import { views } from "../../../lib/activity";

export const runtime = "nodejs";
const LEGACY_USERS = 185; // members counted before the 28 Oct database move, until the old data is merged back
export const dynamic = "force-dynamic";

export async function GET(req) {
  const s = readSession(req);
  const m = s ? await ensureMember(s.sub) : null;
  const r = await roster();
  const left = seatsLeft(r);
  if (!m) return Response.json({ member: null, seats: seats(), left, users: Math.max(LEGACY_USERS, r.active.length), views: await views(), loginReady: !!(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET) });
  // owners are Pro for life
  if (r.admins.includes(m.id) && (m.plan !== "pro" || m.proUntil || m.pendingOrder)) {
    makeAdminPro(m);
    await saveMember(m);
  }
  const view = await viewOf(m), rules = view.rules, info = planInfo(m);
  const pos = m.status === "waitlist" ? r.waitlist.indexOf(m.id) + 1 : 0;
  return Response.json({
    member: { name: m.name, picture: m.picture, status: m.status, admin: r.admins.includes(m.id), waitlistPosition: pos, onboarding: m.onboarding || { done: [] }, ...info,
      // the limits that apply right now (Paywall V2 aware)
      limits: { ...info.limits, aiPerDay: rules.aiPerDay, topPerCat: view.pro ? null : rules.show, linksPerDay: rules.linksPerDay === Infinity ? null : rules.linksPerDay, oneCat: rules.oneCat },
      dayCat: todayCat(m), founding: !!m.founding,
      freeSince: m.freeSince || null, joinedAt: m.joinedAt, botSeenAt: m.botSeenAt || null, pendingOrder: m.pendingOrder || null, payments: m.payments || [],
      aiToday: m.ai?.day === new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) ? m.ai.count : 0 },
    seats: seats(), left, users: Math.max(LEGACY_USERS, r.active.length), views: await views(), loginReady: true, price: PRICE,
    offer: { founding: foundingOpen(m), month: (foundingOpen(m) ? ORDERS.fmonth : ORDERS.month).price, year: (foundingOpen(m) ? ORDERS.fyear : ORDERS.year).price },
    paywall: { v2: view.v2, at: PAYWALL_AT, countdown: await countdownLine(view) },
  });
}

// Record which onboarding steps this member has finished (shown to the admin).
export async function POST(req) {
  const s = readSession(req);
  const m = s ? await getMember(s.sub) : null;
  if (!m) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { done } = (await req.json().catch(() => ({}))) || {};
  const ok = ["line", "bot", "applink", "connector", "shopee", "scan", "ai"];
  const list = Array.isArray(done) ? [...new Set(done.filter((d) => ok.includes(d)))] : [];
  const cur = m.onboarding?.done || [];
  if (list.length !== cur.length || list.some((d) => !cur.includes(d))) {
    m.onboarding = { done: list, updatedAt: Date.now() };
    await saveMember(m);
  }
  return Response.json({ ok: true });
}
