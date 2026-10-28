// Discord notifications: new signups and sales events (plan chosen, slip received, approved).
// Set DISCORD_WEBHOOK_URL in Vercel env; without it these calls do nothing.
const COLORS = { signup: 0x06c755, interest: 0xf5a524, slip: 0x22c55e, approved: 0x3b82f6, rejected: 0xef4444 };

export async function notifyDiscord(kind, { title, lines = [], image } = {}) {
  // signups can go to their own channel (DISCORD_SIGNUP_WEBHOOK_URL), else the same one
  const url = (kind === "signup" && process.env.DISCORD_SIGNUP_WEBHOOK_URL) || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  const embed = { title, description: lines.join("\n"), color: COLORS[kind] || 0x888888, timestamp: new Date().toISOString(),
    ...(image ? { image: { url: "attachment://slip.jpg" } } : {}) };
  const payload = { username: "ปั๊กปัก", embeds: [embed] };
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
