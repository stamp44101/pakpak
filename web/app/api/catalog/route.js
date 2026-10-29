// Shared catalog for the web app. What each member gets is decided in lib/access.js.
// Free V2 sees one category a day: ?cat=<name> picks today's (the first pick holds for the day).
import { requireMember } from "../../../lib/auth";
import { viewOf, sharedCatalog, chooseCat, todayCat } from "../../../lib/access";
import { addViews } from "../../../lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  const view = await viewOf(member);
  if (!view.rules.oneCat) {
    const { products, locked, cats } = await sharedCatalog(view);
    addViews(Object.keys(products).length).catch(() => {});
    return Response.json({ products, cats, ...(view.lockCat ? { locked } : {}) });
  }
  const want = new URL(req.url).searchParams.get("cat");
  let msg = null;
  if (want) { const r = await chooseCat(member, want, view); if (!r.ok) msg = `วันนี้คุณเลือกหมวด "${r.cat}" แล้ว แพ็ก Free ดูได้วันละ 1 หมวด พรุ่งนี้เลือกใหม่ได้`; }
  const dayCat = todayCat(member);
  const { products, locked, cats } = await sharedCatalog(view, { only: dayCat || "" });
  addViews(Object.keys(products).length).catch(() => {});
  return Response.json({ products, cats, locked, oneCat: true, dayCat, ...(msg ? { msg } : {}) });
}
