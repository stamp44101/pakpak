// LINE Login session + Early Access members (stored in the private Blob store).
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { readJSON, writeJSON, updateJSON, listPaths } from "./store";
import { notifyDiscord } from "./discord";
import { grantPro, EA_DAYS, expireOrder } from "./plan";

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
  return c ? readSessionValue(c.slice(COOKIE.length + 1)) : null;
}

// Same check from a raw cookie value (server components use next/headers cookies()).
export const SESSION_COOKIE = COOKIE;
export function readSessionValue(value) {
  if (!process.env.LINE_CHANNEL_SECRET || !value) return null;
  const [body, sig] = value.split(".");
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
  if (m && expireOrder(m)) await writeJSON(memberPath(m.id), m); // written once, when the order lapses
  if (m && m.status === "waitlist") await openFree(m); // the old waitlist now gets Free right away
  if (m && m.plan === undefined && m.status === "active") {
    const r = await roster();
    grantPro(m, r.admins.includes(m.id) ? null : EA_DAYS, { early: true });
    await writeJSON(memberPath(m.id), m);
  }
  return m;
}
export const saveMember = (m) => writeJSON(memberPath(m.id), m);

// The member roster: who is in, who waits. Small enough to keep as one document.
// The new database started empty on 28 Oct 2026 (old Blob store suspended): the 10 Early Access seats
// were already taken, so the roster starts with them marked as used.
const freshRoster = () => ({ active: [], waitlist: [], admins: [], early: Array(10).fill("legacy") });
// "active" is derived from the member documents themselves (one row per member, no hot shared list);
// the roster document only keeps the rarely-changing parts: admins, early seats, restored EA names.
export async function roster() {
  const [doc, paths] = await Promise.all([readJSON("meta/roster.json"), listPaths("members/")]);
  const r = { ...freshRoster(), ...(doc || {}) };
  r.active = paths.map((p) => p.slice(8, -5));
  r.waitlist = []; r.revoked = [];
  return r;
}
// Changes to admins / early / restored. fn may run more than once; active/waitlist/revoked edits are ignored.
export const mutateRoster = (fn) => updateJSON("meta/roster.json", async (r) => {
  r.admins ||= []; r.early ||= Array(10).fill("legacy");
  const view = { ...r, active: [], waitlist: [], revoked: [] };
  await fn(view);
  return { admins: view.admins, early: view.early, restored: view.restored || r.restored || [] };
}, freshRoster);
const addTo = (arr, id) => { if (!arr.includes(id)) arr.push(id); };

// Early Access members from before the move get their Pro back when they show up again (matched by LINE name).
const LEGACY_EA = ["Ainz", "M", "Bas", "Ettt", "Jutharat✨", "🌟Dreammy🌟", "ªňňª ❸🐐❺🐷", "poupae", "1ST"];
async function restoreLegacy(m) {
  if (m.legacyChecked || !m.name || m.name === "สมาชิก") return false;
  m.legacyChecked = true;
  if (!LEGACY_EA.includes(m.name)) return true;
  let taken = false;
  await mutateRoster((r) => { r.restored ||= []; taken = r.restored.includes(m.name); if (!taken) r.restored.push(m.name); });
  if (taken) return true;
  m.welcomeFree = false; m.freeSince = null; m.plan = undefined; m.proUntil = undefined;
  grantPro(m, EA_DAYS, { early: true });
  return true;
}

// Returning members after the move: recreate them on the spot (Free, or EA Pro restored) so nobody has to sign up again.
export async function ensureMember(sub, profile = {}) {
  let m = await getMember(sub);
  if (m) {
    if (profile.name && (m.name === "สมาชิก" || !m.legacyChecked)) {
      m.name = profile.name; m.picture = profile.picture || m.picture;
      if (await restoreLegacy(m)) await saveMember(m);
    }
    return m;
  }
  const r = await roster();
  if (!r.admins.length) return null; // before the owner has claimed the new database nobody is auto-created
  m = { id: sub, name: profile.name || "สมาชิก", picture: profile.picture || "", status: "active", joinedAt: Date.now(), ai: { day: "", count: 0 },
    plan: "free", proUntil: null, freeSince: Date.now(), returning: true };
  await restoreLegacy(m);
  await saveMember(m);
  await announceSignup(m, profile.name ? "เริ่มจากแชทบอท" : "เริ่มจากเว็บ").catch(() => {});
  return m;
}
// Whole-document write: only for callers that already hold a fresh copy and accept last-write-wins.
export const saveRoster = (r) => writeJSON("meta/roster.json", r);

// Early Access seats taken. Before this list existed every active member held one.
export const earlyTaken = (r) => (r.early || r.active).length;
export const seatsLeft = (r) => Math.max(0, seats() - earlyTaken(r));

// Move a waiting member onto the Free plan and mark them to be welcomed (web banner + bot card).
export async function openFree(m, r) {
  m.status = "active"; m.plan = "free"; m.proUntil = null;
  m.freeSince = Date.now(); m.welcomeFree = true;
  await saveMember(m);
  return m;
}

// First login: take an Early Access seat (Pro 30 days) if one is left, else start on Free right away.
// The very first member becomes the admin (that is the owner, who signs in first).
export async function joinOrUpdate(profile) {
  let m = await getMember(profile.sub);
  if (!m) {
    let early = false; // the owner claims admin explicitly via /api/admin/claim
    if (seatsLeft(await roster()) > 0) await mutateRoster((x) => {
      early = !x.early.includes(profile.sub) && seatsLeft(x) > 0;
      if (early) x.early.push(profile.sub);
    });
    m = { id: profile.sub, name: profile.name, picture: profile.picture || "", status: "active", joinedAt: Date.now(), ai: { day: "", count: 0 } };
    if (early) grantPro(m, EA_DAYS, { early: true });
    else { m.plan = "free"; m.proUntil = null; m.freeSince = Date.now(); m.welcomeFree = true; }
    m.isNew = true;
  } else {
    m.name = profile.name; m.picture = profile.picture || m.picture;
  }
  await restoreLegacy(m);
  const isNew = m.isNew; delete m.isNew;
  await saveMember(m);
  if (isNew) await announceSignup(m, "สมัครผ่านเว็บ/LINE Login").catch(() => {});
  return m;
}

// For API routes: returns the active member, or a Response to send back.
export async function requireMember(req, { active = true } = {}) {
  const s = readSession(req);
  if (!s) return { error: Response.json({ error: "กรุณาเข้าสู่ระบบด้วย LINE" }, { status: 401 }) };
  const m = await ensureMember(s.sub);
  if (!m) return { error: Response.json({ error: "ไม่พบสมาชิก" }, { status: 401 }) };
  if (active && m.status !== "active") return { error: Response.json({ error: "บัญชียังไม่ได้เปิดใช้งาน" }, { status: 403 }) };
  return { member: m };
}

export async function isAdmin(sub) {
  const r = await roster();
  return r.admins.includes(sub);
}

export const newState = () => randomBytes(16).toString("hex");

// Real-time signup feed for the team (Discord).
async function announceSignup(m, via) {
  const total = (await listPaths("members/")).length;
  await notifyDiscord("signup", { title: `👋 สมาชิกใหม่ #${total.toLocaleString("en-US")}`, lines: [`**${m.name || "สมาชิก"}** · ${via} · ${m.plan === "pro" ? "Pro (EA)" : "Free"}`] });
}
