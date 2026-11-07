// Rank-change labels (🆕 / ↑3 / ↓2): a product's place in its category today vs the last earlier day.
// Snapshots are written with the daily sales snapshot in lib/trending.js (recordSold) — no member fields.
export const MV_KEEP = 30; // how deep each category's snapshot goes
export const MV_SHOW = 20; // label only the top 20; lower down the movement is noise

// prev: yesterday's ids for the category, best first. pos: today's 1-based rank.
export function moveOf(prev, pos, id) {
  if (!Array.isArray(prev) || !prev.length || !(pos >= 1) || pos > MV_SHOW) return null;
  const i = prev.indexOf(id);
  if (i < 0) return "new";
  const d = i + 1 - pos;
  return d || null;
}

export const mvLabel = (v) => (v === "new" ? "🆕" : v > 0 ? `↑${v}` : v < 0 ? `↓${-v}` : "");
