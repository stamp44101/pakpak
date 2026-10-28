// Who used ปั๊กปัก today (Thai time) — one small doc, rewritten only when someone new shows up today.
import { readJSON, writeJSON } from "./store";

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function touch(id) {
  if (!id) return;
  const d = today();
  const a = (await readJSON("meta/activity.json")) || {};
  if (a.day !== d) { a.prev = a.day ? { day: a.day, count: (a.ids || []).length } : a.prev; a.day = d; a.ids = []; }
  if (a.ids.includes(id)) return;
  a.ids.push(id);
  await writeJSON("meta/activity.json", a);
}

export async function activeToday() {
  const a = (await readJSON("meta/activity.json")) || {};
  return a.day === today() ? (a.ids || []).length : 0;
}

// Product cards people have looked at (bot carousels + web catalog). Seeded with what the OA chat log
// showed before counting started (~80 "ท็อป 5" replies on 28 Oct 2026).
const SEED_VIEWS = 400;
// Buffered per server instance and written at most every 10 minutes: Blob writes are the scarce resource.
let pending = 0, lastFlush = 0;
export async function addViews(n) {
  if (!n) return;
  pending += n;
  if (Date.now() - lastFlush < 10 * 60e3) return;
  lastFlush = Date.now();
  const add = pending; pending = 0;
  const s = (await readJSON("meta/stats.json")) || { views: SEED_VIEWS };
  s.views = (s.views || 0) + add;
  await writeJSON("meta/stats.json", s);
}
export async function views() {
  return ((await readJSON("meta/stats.json")) || { views: SEED_VIEWS }).views || 0;
}
