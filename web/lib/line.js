// LINE Messaging API helpers (bot in the ปั๊กปัก OA).
import { createHmac, timingSafeEqual } from "crypto";
import { notifyError } from "./discord";
import { validateMessages } from "./bot/validate";

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
  if (!r.ok) {
    const err = (await r.text()).slice(0, 500);
    console.error("LINE", path, r.status, err);
    // Function logs vanish after ~1 h; Discord keeps it. 429 here = push quota exhausted.
    if (body?.messages) notifyError(`⚠️ LINE ${path} → ${r.status}`, [err, "payload: " + summary(body.messages)]).catch(() => {});
  }
  return r.ok;
}

// One line describing a message batch, for the error report (types + first text/altText).
const summary = (ms) => [].concat(ms).map((m) => `${m?.type}${m?.altText || m?.text ? ` "${String(m.altText || m.text).slice(0, 60)}"` : ""}`).join(" | ").slice(0, 400);

// Plain-text fallback when a reply can't be delivered as built. No Flex, so nothing left to reject.
export const FALLBACK = { type: "text", text: "ขอโทษค่ะ ส่งข้อความชุดนี้ไม่สำเร็จ ลองกดหรือพิมพ์ใหม่อีกครั้งนะคะ 🙏",
  quickReply: { items: [["🔥 มาแรง", "มาแรง"], ["ท็อป 5", "ท็อป"], ["เลือกหมวด", "หมวด"], ["วิธีใช้", "วิธีใช้"]].map(([label, text]) => ({ type: "action", action: { type: "message", label, text } })) } };

// Raw Messaging API call (data: true → api-data.line.me for image uploads).
export async function botFetch(path, { data, headers, ...opt } = {}) {
  return fetch(`https://${data ? "api-data" : "api"}.line.me/v2/bot/${path}`, {
    ...opt,
    headers: { authorization: "Bearer " + (await token()), "content-type": "application/json", ...headers },
  });
}

// Reply tokens work once, so the payload is checked first: a message LINE would reject (mixed bubble sizes,
// altText too long, empty text…) is swapped for FALLBACK while the token is still good, and reported to Discord.
// Returns false when LINE itself refused the send — the webhook then pushes FALLBACK to the user.
export async function reply(replyToken, messages) {
  const list = [].concat(messages).slice(0, 5);
  const problems = validateMessages(list);
  if (problems.length) {
    console.error("LINE reply blocked by validator", problems);
    notifyError("⚠️ LINE reply blocked (validator)", [...problems.slice(0, 8), "payload: " + summary(list)]).catch(() => {});
    return call("message/reply", { replyToken, messages: [FALLBACK] });
  }
  return call("message/reply", { replyToken, messages: list });
}

export async function push(to, messages) {
  const list = [].concat(messages).slice(0, 5);
  const problems = validateMessages(list);
  if (problems.length) {
    console.error("LINE push blocked by validator", problems);
    notifyError("⚠️ LINE push blocked (validator)", [...problems.slice(0, 8), "payload: " + summary(list)]).catch(() => {});
    return false;
  }
  return call("message/push", { to, messages: list });
}
// Monthly push quota of the OA. Replies are free and unlimited; push / multicast count here.
// → { type: "limited" | "none", value: number|null, used: number, left: number|null }, null when LINE can't be reached.
// Cached 60 s per instance; markPushed() keeps the cache honest after a group send.
let q = { v: null, at: 0 };
export async function quota({ fresh = false } = {}) {
  if (!fresh && q.v && Date.now() - q.at < 60e3) return q.v;
  try {
    const [a, b] = await Promise.all(["message/quota", "message/quota/consumption"].map((p) => botFetch(p, { method: "GET" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${p} ${r.status}`))))));
    const value = a.type === "limited" ? a.value : null, used = b.totalUsage || 0;
    q = { v: { type: a.type, value, used, left: value == null ? null : Math.max(0, value - used) }, at: Date.now() };
    return q.v;
  } catch (err) {
    console.error("LINE quota", err);
    return null;
  }
}
export function markPushed(n) {
  if (q.v) q.v = { ...q.v, used: q.v.used + n, left: q.v.left == null ? null : Math.max(0, q.v.left - n) };
}

export const loading =(chatId, seconds = 20) => call("chat/loading/start", { chatId, loadingSeconds: seconds });
