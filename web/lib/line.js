// LINE Messaging API helpers (bot in the ปั๊กปัก OA).
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = () => process.env.LINE_MSG_CHANNEL_SECRET || "";
export const LIFF_URL = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || "2012241865-bvKNVlJR"}`;

export function verifySignature(raw, sig) {
  if (!SECRET() || !sig) return false;
  const a = Buffer.from(createHmac("sha256", SECRET()).update(raw).digest("base64"));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Stateless channel access token (15 min), minted from the channel ID + secret — no long-lived token to store.
let tok = { v: "", exp: 0 };
async function token() {
  if (tok.v && tok.exp > Date.now() + 60e3) return tok.v;
  const r = await fetch("https://api.line.me/oauth2/v3/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.LINE_MSG_CHANNEL_ID || "", client_secret: SECRET() }),
  }).then((x) => x.json());
  if (!r.access_token) throw new Error("LINE token: " + JSON.stringify(r).slice(0, 200));
  tok = { v: r.access_token, exp: Date.now() + (r.expires_in || 900) * 1000 };
  return tok.v;
}

async function call(path, body) {
  const r = await fetch("https://api.line.me/v2/bot/" + path, {
    method: "POST",
    headers: { authorization: "Bearer " + (await token()), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) console.error("LINE", path, r.status, (await r.text()).slice(0, 500));
  return r.ok;
}

// Raw Messaging API call (data: true → api-data.line.me for image uploads).
export async function botFetch(path, { data, headers, ...opt } = {}) {
  return fetch(`https://${data ? "api-data" : "api"}.line.me/v2/bot/${path}`, {
    ...opt,
    headers: { authorization: "Bearer " + (await token()), "content-type": "application/json", ...headers },
  });
}

export const reply = (replyToken, messages) => call("message/reply", { replyToken, messages: [].concat(messages).slice(0, 5) });
export const push = (to, messages) => call("message/push", { to, messages: [].concat(messages).slice(0, 5) });
export const loading = (chatId, seconds = 20) => call("chat/loading/start", { chatId, loadingSeconds: seconds });
