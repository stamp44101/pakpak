// "เอาลิงก์ของฉัน" on the web: build the member's own affiliate link from their Affiliate ID,
// counted against the daily allowance (Free V2: 3/day, see lib/access.js).
import { requireMember, saveMember } from "../../../lib/auth";
import { viewOf, useLink } from "../../../lib/access";
import { parseAffId, affLink, cleanProductUrl } from "../../../lib/afflink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const { url, id } = (await req.json().catch(() => ({}))) || {};
  const aff = parseAffId(String(id || ""));
  if (!aff) return Response.json({ error: "badId" }, { status: 400 });
  if (!url || !cleanProductUrl(url)) return Response.json({ error: "ลิงก์สินค้าไม่ถูกต้อง" }, { status: 400 });
  const quota = useLink(member, await viewOf(member));
  if (!quota.ok) return Response.json({ error: `แพ็ก Free ทำลิงก์ได้วันละ ${quota.limit} ลิงก์ ครบแล้ววันนี้ พรุ่งนี้ทำต่อได้ หรืออัปเกรด Pro ทำได้ไม่จำกัด`, upgrade: true }, { status: 429 });
  member.affId = aff;
  await saveMember(member);
  return Response.json({ link: affLink(url, aff), left: quota.left });
}
