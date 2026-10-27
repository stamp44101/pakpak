// LINE Login callback: verify, create or update the member, set the session cookie.
import { appUrl, joinOrUpdate, sessionCookie } from "../../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (req, q, cookies = []) => {
  const h = new Headers({ location: `${appUrl(req)}/${q ? "?" + q : ""}` });
  for (const c of cookies) h.append("set-cookie", c);
  h.append("set-cookie", "pp_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(null, { status: 302, headers: h });
};

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = (req.headers.get("cookie") || "").match(/(?:^|;\s*)pp_state=([a-f0-9]+)/)?.[1];
  if (url.searchParams.get("error")) return back(req, "login=cancelled");
  if (!code || !state || state !== saved) return back(req, "login=failed");

  const id = process.env.LINE_CHANNEL_ID, secret = process.env.LINE_CHANNEL_SECRET;
  const tok = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${appUrl(req)}/api/auth/line/callback`, client_id: id, client_secret: secret }),
  }).then((r) => r.json()).catch(() => null);
  if (!tok || !tok.id_token) return back(req, "login=failed");

  const prof = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: tok.id_token, client_id: id }),
  }).then((r) => r.json()).catch(() => null);
  if (!prof || !prof.sub) return back(req, "login=failed");

  await joinOrUpdate({ sub: prof.sub, name: prof.name || "สมาชิก", picture: prof.picture });
  return back(req, "", [sessionCookie(prof.sub)]);
}
