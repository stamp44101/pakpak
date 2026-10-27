// Start LINE Login.
import { appUrl, newState } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const id = process.env.LINE_CHANNEL_ID;
  if (!id || !process.env.LINE_CHANNEL_SECRET) return new Response("LINE Login ยังตั้งค่าไม่ครบ (LINE_CHANNEL_ID / LINE_CHANNEL_SECRET)", { status: 500 });
  const state = newState();
  const u = new URL("https://access.line.me/oauth2/v2.1/authorize");
  u.search = new URLSearchParams({
    response_type: "code", client_id: id, state, scope: "profile openid",
    redirect_uri: `${appUrl(req)}/api/auth/line/callback`,
  });
  return new Response(null, {
    status: 302,
    headers: { location: u.toString(), "set-cookie": `pp_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` },
  });
}
