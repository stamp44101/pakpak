// Who am I + how many Early Access seats are left.
import { readSession, getMember, roster, seats } from "../../../lib/auth";

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
    member: { name: m.name, picture: m.picture, status: m.status, admin: r.admins.includes(m.id), waitlistPosition: pos },
    seats: seats(), left, loginReady: true,
  });
}
