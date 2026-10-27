// Who am I + how many Early Access seats are left.
import { readSession, getMember, saveMember, roster, seats } from "../../../lib/auth";
import { planInfo, PRICE } from "../../../lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const r = await roster();
  const left = Math.max(0, seats() - r.active.length);
  const s = readSession(req);
  const m = s ? await getMember(s.sub) : null;
  if (!m) return Response.json({ member: null, seats: seats(), left, loginReady: !!(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET) });
  const pos = m.status === "waitlist" ? r.waitlist.indexOf(m.id) + 1 : 0;
  return Response.json({
    member: { name: m.name, picture: m.picture, status: m.status, admin: r.admins.includes(m.id), waitlistPosition: pos, onboarding: m.onboarding || { done: [] }, ...planInfo(m) },
    seats: seats(), left, loginReady: true, price: PRICE,
  });
}

// Record which onboarding steps this member has finished (shown to the admin).
export async function POST(req) {
  const s = readSession(req);
  const m = s ? await getMember(s.sub) : null;
  if (!m) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { done } = (await req.json().catch(() => ({}))) || {};
  const ok = ["connector", "shopee", "scan", "ai"];
  const list = Array.isArray(done) ? [...new Set(done.filter((d) => ok.includes(d)))] : [];
  const cur = m.onboarding?.done || [];
  if (list.length !== cur.length || list.some((d) => !cur.includes(d))) {
    m.onboarding = { done: list, updatedAt: Date.now() };
    await saveMember(m);
  }
  return Response.json({ ok: true });
}
