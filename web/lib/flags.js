// Runtime switches kept in the database (meta/flags.json), so a test can be turned on or rolled back
// from the LINE bot without a redeploy. Cached per server instance for 30s: a change reaches everyone within ~30s.
import { readJSON, writeJSON } from "./store";

const PATH = "meta/flags.json";
let cache = { at: 0, v: null };

export async function flags() {
  if (cache.v && Date.now() - cache.at < 30e3) return cache.v;
  const v = (await readJSON(PATH).catch(() => null)) || {};
  cache = { at: Date.now(), v };
  return v;
}

export async function setFlag(key, value, by) {
  const v = { ...((await readJSON(PATH)) || {}), [key]: value, [key + "At"]: Date.now(), [key + "By"]: by || null };
  await writeJSON(PATH, v);
  cache = { at: Date.now(), v };
  return v;
}

// Stable 0–99 bucket per member: the same person stays in the same group while a rollout % holds.
export const bucket = (id) => { let h = 0; for (const c of String(id || "")) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 100; };

// photoSearch switch (ถ่ายรูปหาตะกร้า, lib/vision.js): "off" | "admin" | 1–100 (% of members, Free and Pro).
// "admin" = admins only, in "ดูแบบ free" or "ดูแบบ pro" (to test the old path, use "off"). Any other value includes admins too.
// Its own bucket salt, so the photo group isn't the same people as the lock-top-5 group. Env PHOTO_SEARCH=off = kill switch.
export function photoSearchFor(f, m, { admin = false } = {}) {
  if (process.env.PHOTO_SEARCH === "off") return false;
  const v = f?.photoSearch;
  if (!v || v === "off") return false;
  if (admin) return true;
  if (v === "admin") return false;
  return bucket("photo:" + (m?.id || "")) < Math.min(100, +v || 0);
}
export const photoSearchLabel = (v) => (!v || v === "off" ? "ปิด (ส่งรูปแล้วบอทเงียบตามเดิม)" : v === "admin" ? "ทดสอบเฉพาะแอดมิน (ทั้ง \"ดูแบบ free\" และ \"ดูแบบ pro\")" : `เปิด ${v}% ของผู้ใช้`);
