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
