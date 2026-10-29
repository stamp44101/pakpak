// Campaigns: free Pro days handed out by an admin (/admin → "🎁 ให้สิทธิ์", managed at /admin/campaigns).
// A campaign is data in meta/campaigns.json, not code: adding one never adds a button or a member field.
// Every grant lands in m.grants = [{ campaign, days, at, by, wasPro }].
import { readJSON, updateJSON } from "./store";
import { grantPro, isPro } from "./plan";
import { thDate } from "./fmt";

export const PATH = "meta/campaigns.json";
// Ceiling on free days one member can collect from campaigns, so freebies don't replace paying.
export const FREE_DAYS_CAP = 14;

// The first two existed as their own buttons before; their old records (trialAt, followReward) still count.
const SEED = {
  trial7: { key: "trial7", label: "ทดลองฟรี 7 วัน", days: 7, perMember: 1, who: "all", active: true, createdAt: 0,
    message: "🎁 แอดมินเปิดให้ทดลองใช้ Pro ฟรี {days} วัน ใช้ได้ถึง {until}\nดูตะกร้าได้ทุกหมวดทุกอันดับ + AI ไอเดียคลิปวันละ 30 ครั้ง\nกด \"ท็อป 5 วันนี้\" ที่เมนูด้านล่างเพื่อเริ่มได้เลยค่ะ" },
  "follow-igfb": { key: "follow-igfb", label: "ติดตาม IG + FB", days: 3, perMember: 1, who: "all", active: true, createdAt: 0, proof: "ติดตามทั้ง IG และ FB",
    message: "🎁 ขอบคุณที่ติดตามปั๊กปักทั้ง IG และ FB ค่ะ\nได้ Pro เพิ่ม {days} วัน ใช้ได้ถึง {until}" },
};

export async function loadCampaigns() {
  const doc = await readJSON(PATH);
  return { ...SEED, ...(doc || {}) };
}

// Live = switched on and inside its dates (dates are optional).
export const isLive = (c, now = Date.now()) => !!c.active && (!c.startAt || c.startAt <= now) && (!c.endAt || c.endAt > now);

// Grants including the records from before campaigns existed.
export function grantsOf(m) {
  const g = [...(m.grants || [])];
  if (m.trialAt && !g.some((x) => x.campaign === "trial7")) g.push({ campaign: "trial7", days: 7, at: m.trialAt, by: "", legacy: true });
  if (m.followReward && !g.some((x) => x.campaign === "follow-igfb")) g.push({ campaign: "follow-igfb", days: 3, at: m.followReward.at, by: m.followReward.by, wasPro: m.followReward.wasPro, legacy: true });
  return g.sort((a, b) => a.at - b.at);
}
export const freeDaysOf = (m) => grantsOf(m).reduce((t, g) => t + (g.days || 0), 0);

// Why this member can't get this campaign right now ("" = can).
export function blockReason(m, c) {
  if (!c) return "ไม่พบแคมเปญ";
  if (!isLive(c)) return `แคมเปญ "${c.label}" ปิดอยู่หรือหมดเวลาแล้ว`;
  if (m.status !== "active") return "ต้องเป็นสมาชิกที่ใช้งานอยู่";
  if (isPro(m) && m.proUntil === null) return `${m.name} เป็น Pro ไม่มีวันหมดอยู่แล้ว`;
  if (c.who === "free" && isPro(m)) return `แคมเปญนี้สำหรับคน Free · ${m.name} เป็น Pro อยู่`;
  if (c.who === "pro" && !isPro(m)) return `แคมเปญนี้สำหรับคน Pro · ${m.name} เป็น Free อยู่`;
  const mine = grantsOf(m).filter((g) => g.campaign === c.key);
  if (c.perMember && mine.length >= c.perMember) return `${m.name} ได้สิทธิ์ "${c.label}" ไปแล้ว (${thDate(mine[mine.length - 1].at)})`;
  if (freeDaysOf(m) + c.days > FREE_DAYS_CAP) return `${m.name} ได้วันฟรีจากแคมเปญไปแล้ว ${freeDaysOf(m)} วัน เกินเพดาน ${FREE_DAYS_CAP} วัน`;
  return "";
}

// Version-checked: re-checks on the freshly read member so a double click can't grant twice.
export async function grant(memberPath, m, c, by) {
  let err = "", wasPro = false;
  const saved = await updateJSON(memberPath, (cur) => {
    err = blockReason(cur, c);
    if (err) return cur;
    wasPro = isPro(cur);
    grantPro(cur, c.days);
    cur.grants = [...(cur.grants || []), { campaign: c.key, days: c.days, at: Date.now(), by, wasPro }];
    return cur;
  }, () => m);
  return { err, wasPro, member: saved };
}

export const messageFor = (c, m) => (c.message || "🎁 ได้รับ Pro เพิ่ม {days} วัน ใช้ได้ถึง {until}").replaceAll("{days}", c.days).replaceAll("{until}", thDate(m.proUntil)).replaceAll("{name}", m.name || "");

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
// Create or edit. Days and repeat count are clamped; the key never changes once made (grants point at it).
export async function saveCampaign(input, by) {
  const days = Math.max(1, Math.min(FREE_DAYS_CAP, Math.round(Number(input.days) || 0)));
  const label = String(input.label || "").trim().slice(0, 60);
  if (!label) throw new Error("ต้องมีชื่อแคมเปญ");
  let out;
  await updateJSON(PATH, (doc) => {
    const all = { ...SEED, ...doc };
    const key = input.key && all[input.key] ? input.key : slug(input.key || label) || "c" + Date.now().toString(36);
    if (!input.key && all[key]) throw new Error("มีแคมเปญชื่อนี้แล้ว");
    const prev = all[key] || { createdAt: Date.now(), createdBy: by };
    out = { ...prev, key, label, days, perMember: Math.max(1, Math.min(10, Math.round(Number(input.perMember) || 1))),
      who: ["free", "pro"].includes(input.who) ? input.who : "all", active: !!input.active,
      startAt: input.startAt ? Number(input.startAt) : null, endAt: input.endAt ? Number(input.endAt) : null,
      proof: String(input.proof || "").slice(0, 120), message: String(input.message || "").slice(0, 900), updatedAt: Date.now(), updatedBy: by };
    return { ...doc, [key]: out };
  });
  return out;
}
