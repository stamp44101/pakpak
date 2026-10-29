// Discord notifications: new signups and sales events (plan chosen, slip received, approved).
// Set DISCORD_WEBHOOK_URL in Vercel env; without it these calls do nothing.
const COLORS = { signup: 0x06c755, interest: 0xf5a524, slip: 0x22c55e, approved: 0x3b82f6, rejected: 0xef4444, error: 0xdc2626, backup: 0x64748b };

export async function notifyDiscord(kind, { title, lines = [], image } = {}) {
  // signups can go to their own channel (DISCORD_SIGNUP_WEBHOOK_URL), else the same one
  const url = (kind === "signup" && process.env.DISCORD_SIGNUP_WEBHOOK_URL) || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  const embed = { title, description: lines.join("\n"), color: COLORS[kind] || 0x888888, timestamp: new Date().toISOString(),
    ...(image ? { image: { url: "attachment://slip.jpg" } } : {}) };
  // Slips ping the people who check money: DISCORD_SLIP_MENTIONS = comma-separated Discord user IDs (not usernames)
  const ids = kind === "slip" ? (process.env.DISCORD_SLIP_MENTIONS || "").split(",").map((x) => x.trim()).filter((x) => /^\d{15,21}$/.test(x)) : [];
  const payload = { username: "ปั๊กปัก", embeds: [embed], ...(ids.length ? { content: ids.map((id) => `<@${id}>`).join(" ") + " มีสลิปใหม่ 💰", allowed_mentions: { users: ids } } : {}) };
  let res;
  if (image) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    form.append("files[0]", new Blob([image], { type: "image/jpeg" }), "slip.jpg");
    res = await fetch(url, { method: "POST", body: form });
  } else {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  }
  if (!res.ok) console.error("discord", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

// Bot/system failures (a LINE reply rejected, a handler throwing). Function logs keep only ~1 hour, so this is the
// record. Throttled per title (one per 15 s per instance) so a storage outage doesn't flood the channel.
const lastErr = new Map();
export async function notifyError(title, lines = []) {
  const now = Date.now();
  if (now - (lastErr.get(title) || 0) < 15e3) return false;
  lastErr.set(title, now);
  return notifyDiscord("error", { title, lines: lines.map((l) => String(l).slice(0, 900)) }).catch(() => false);
}
