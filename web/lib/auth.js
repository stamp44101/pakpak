// LINE Login session + Early Access members (stored in the private Blob store).
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { readJSON, writeJSON } from "./store";
import { grantPro, TRIAL_DAYS } from "./plan";

const COOKIE = "pp_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const appUrl = (req) => process.env.APP_URL && !new URL(req.url).host.startsWith("localhost") ? process.env.APP_URL : new URL(req.url).origin;
export const seats = () => Number(process.env.EARLY_ACCESS_SEATS || 10);
const key = () => createHmac("sha256", "pukpak-session").update(process.env.LINE_CHANNEL_SECRET || "").digest();
const sign = (s) => createHmac("sha256", key()).update(s).digest("base64url");

export function sessionCookie(sub) {
  const body = Buffer.from(JSON.stringify({ sub, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function readSession(req) {
  if (!process.env.LINE_CHANNEL_SECRET) return null;
  const c = (req.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!c) return null;
  const [body, sig] = c.slice(COOKIE.length + 1).split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

export const memberPath = (sub) => `members/${sub}.json`;
// Members from before plans existed: active ones become Early Access Pro (owner: no expiry).
export async function getMember(sub) {
  const m = await readJSON(memberPath(sub));
  if (m && m.plan === undefined && m.status === "active") {
    const r = await roster();
    grantPro(m, r.admins.includes(m.id) ? null : TRIAL_DAYS, { early: true });
    await writeJSON(memberPath(m.id), m);
  }
  return m;
}
export const saveMember = (m) => writeJSON(memberPath(m.id), m);

// The member roster: who is in, who waits. Small enough to keep as one document.
export async function roster() {
  return (await readJSON("meta/roster.json")) || { active: [], waitlist: [], admins: [] };
}
export const saveRoster = (r) => writeJSON("meta/roster.json", r);

// First login: take an Early Access seat if one is left, else join the waitlist.
// The very first member becomes the admin (that is the owner, who signs in first).
export async function joinOrUpdate(profile) {
  const r = await roster();
  let m = await getMember(profile.sub);
  if (!m) {
    const first = r.active.length === 0 && r.admins.length === 0;
    const status = r.active.length < seats() ? "active" : "waitlist";
    m = { id: profile.sub, name: profile.name, picture: profile.picture || "", status, joinedAt: Date.now(), ai: { day: "", count: 0 } };
    if (status === "active") r.active.push(m.id); else r.waitlist.push(m.id);
    if (first) r.admins.push(m.id);
    if (status === "active") grantPro(m, first ? null : TRIAL_DAYS, { early: true });
    await saveRoster(r);
  } else {
    m.name = profile.name; m.picture = profile.picture || m.picture;
  }
  await saveMember(m);
  return m;
}

// For API routes: returns the active member, or a Response to send back.
export async function requireMember(req, { active = true } = {}) {
  const s = readSession(req);
  if (!s) return { error: Response.json({ error: "กรุณาเข้าสู่ระบบด้วย LINE" }, { status: 401 }) };
  const m = await getMember(s.sub);
  if (!m) return { error: Response.json({ error: "ไม่พบสมาชิก" }, { status: 401 }) };
  if (active && m.status !== "active") return { error: Response.json({ error: "บัญชียังไม่ได้เปิดใช้งาน" }, { status: 403 }) };
  return { member: m };
}

export async function isAdmin(sub) {
  const r = await roster();
  return r.admins.includes(sub);
}

export const newState = () => randomBytes(16).toString("hex");
