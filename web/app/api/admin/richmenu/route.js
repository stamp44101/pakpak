// Admin: install the 6-button rich menu (image in /public/richmenu.png) as the OA default.
// API-set default menus take priority over the one made in OA Manager.
import { requireMember, isAdmin } from "../../../../lib/auth";
import { botFetch, LIFF_URL } from "../../../../lib/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP = process.env.APP_URL || "https://pakpak-two.vercel.app";
const W = 2500, H = 1686, PAD = 36, GAP = 36;
const cw = (W - 2 * PAD - 2 * GAP) / 3, ch = (H - 2 * PAD - GAP) / 2;
const msg = (text) => ({ type: "message", label: text.slice(0, 20), text });
const ACTIONS = [msg("ท็อป"), msg("อัปเกรด Pro"), msg("ลิงก์"), { type: "uri", label: "เปิดปั๊กปัก", uri: LIFF_URL }, msg("วิธีใช้"), msg("ติดต่อแอดมิน")];

export async function POST(req) {
  const { member, error } = await requireMember(req);
  if (error) return error;
  if (!(await isAdmin(member.id))) return Response.json({ error: "สำหรับผู้ดูแลเท่านั้น" }, { status: 403 });

  const areas = ACTIONS.map((action, i) => {
    const c = i % 3, r = Math.floor(i / 3);
    // stretch each tap area over its share of the gaps so the whole menu is tappable
    const x = Math.round(c * (W / 3)), y = Math.round(r * (H / 2));
    return { bounds: { x, y, width: Math.round(W / 3), height: Math.round(H / 2) }, action };
  });
  const menu = { size: { width: W, height: H }, selected: true, name: "pakpak-main-v3", chatBarText: "เมนูปั๊กปัก", areas };

  const old = await botFetch("richmenu/list").then((r) => r.json()).catch(() => ({ richmenus: [] }));
  const created = await botFetch("richmenu", { method: "POST", body: JSON.stringify(menu) }).then((r) => r.json());
  if (!created.richMenuId) return Response.json({ error: "create failed", detail: created }, { status: 502 });
  const png = await fetch(`${APP}/richmenu.png`, { cache: "no-store" }).then((r) => r.arrayBuffer());
  const up = await botFetch(`richmenu/${created.richMenuId}/content`, { method: "POST", body: Buffer.from(png), headers: { "content-type": "image/png" }, data: true });
  if (!up.ok) return Response.json({ error: "image upload failed", detail: await up.text() }, { status: 502 });
  const def = await botFetch(`user/all/richmenu/${created.richMenuId}`, { method: "POST" });
  if (!def.ok) return Response.json({ error: "set default failed", detail: await def.text() }, { status: 502 });
  // remove older API menus of ours
  const removed = [];
  for (const m of old.richmenus || []) if (m.name?.startsWith("pakpak-") && m.richMenuId !== created.richMenuId) { await botFetch(`richmenu/${m.richMenuId}`, { method: "DELETE" }); removed.push(m.richMenuId); }
  return Response.json({ ok: true, richMenuId: created.richMenuId, removed });
}
