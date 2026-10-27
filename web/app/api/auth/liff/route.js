// Sign in from inside the LINE app (LIFF): verify the LIFF ID token, then set the same session cookie.
import { joinOrUpdate, sessionCookie } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { idToken } = (await req.json().catch(() => ({}))) || {};
  if (!idToken || !process.env.LINE_CHANNEL_ID) return Response.json({ error: "bad request" }, { status: 400 });
  const prof = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_CHANNEL_ID }),
  }).then((r) => r.json()).catch(() => null);
  if (!prof || !prof.sub) return Response.json({ error: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ" }, { status: 401 });
  const m = await joinOrUpdate({ sub: prof.sub, name: prof.name || "สมาชิก", picture: prof.picture });
  return new Response(JSON.stringify({ ok: true, status: m.status }), {
    headers: { "content-type": "application/json", "set-cookie": sessionCookie(prof.sub) },
  });
}
