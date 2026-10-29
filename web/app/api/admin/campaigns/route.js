// Campaigns page (/admin/campaigns): list with results, create/edit.
import { requireMember, isAdmin } from "../../../../lib/auth";
import { loadCampaigns, saveCampaign, grantsOf, isLive, FREE_DAYS_CAP } from "../../../../lib/campaigns";
import { allMembers } from "../../../../lib/members";
import { isPro } from "../../../../lib/plan";

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
  const [cs, members] = await Promise.all([loadCampaigns(), allMembers()]);
  const now = Date.now();
  const rows = Object.values(cs).map((c) => {
    // Per campaign: who got it, who is still on those free days, who paid after getting it (the number that matters).
    const got = members.map((m) => ({ m, g: grantsOf(m).filter((x) => x.campaign === c.key) })).filter((x) => x.g.length);
    const paidAfter = got.filter(({ m, g }) => (m.payments || []).some((p) => p.at > g[0].at));
    return { ...c, live: isLive(c, now), granted: got.length, fromFree: got.filter(({ g }) => !g[0].wasPro).length,
      activeNow: got.filter(({ m }) => isPro(m)).length, paidAfter: paidAfter.length,
      revenueAfter: paidAfter.reduce((t, { m, g }) => t + m.payments.filter((p) => p.at > g[0].at).reduce((a, p) => a + (p.amount || 0), 0), 0),
      last: got.map(({ m, g }) => ({ name: m.name, at: g[g.length - 1].at, by: g[g.length - 1].by })).sort((a, b) => b.at - a.at).slice(0, 8) };
  }).sort((a, b) => b.live - a.live || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return Response.json({ campaigns: rows, cap: FREE_DAYS_CAP });
}

export async function POST(req) {
  const g = await guard(req);
  if (g.error) return g.error;
  const body = (await req.json().catch(() => null)) || {};
  try {
    return Response.json({ ok: true, campaign: await saveCampaign(body, g.member.name) });
  } catch (e) {
    return Response.json({ error: e.message || "บันทึกไม่สำเร็จ" }, { status: 400 });
  }
}
