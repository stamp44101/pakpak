// AI clipability score for ONE product, shared by the web app and the LINE bot.
// Results are cached per product for every user, so a product anyone scored before is free.
import { readJSON, writeJSON } from "./store";
import { saveMember } from "./auth";
import { planOf } from "./plan";
import { viewOf, RULES } from "./access";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Returns { score, cached } or { error, status }.
export async function scoreItem(member, item, refresh = false) {
  const id = String(item?.id || "");
  if (!/^\d+_\d+$/.test(id) || !item.name) return { error: "ข้อมูลสินค้าไม่ครบ", status: 400 };
  const cachePath = `ai/${id}.json`;
  if (!refresh) {
    const cached = await readJSON(cachePath);
    if (cached) return { score: cached, cached: true };
  }

  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // Bangkok date
  const used = member.ai?.day === day ? member.ai.count : 0;
  const DAILY = (await viewOf(member)).rules.aiPerDay; // new (uncached) scores per member per day
  if (used >= DAILY) return { error: planOf(member) === "pro" ? `วันนี้ให้ AI ให้คะแนนครบ ${DAILY} ตัวแล้ว พรุ่งนี้ใช้ต่อได้` : `แพ็ก Free ให้ AI ได้วันละ ${DAILY} ตัว ครบแล้ว อัปเกรด Pro เพื่อใช้ได้วันละ ${RULES.pro.aiPerDay} ตัว`, status: 429, upgrade: planOf(member) !== "pro" };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บน server", status: 500 };

  const prompt = `คุณเป็นครีเอเตอร์ทำคลิปสั้น 9:16 ปักตะกร้า Shopee ในไทย ประเมินว่าสินค้านี้ทำคลิปขายได้ง่ายแค่ไหน แล้วส่งผลผ่าน tool submit_score
- problem (0-10): โชว์ปัญหา→ทางแก้ได้ใน 3 วินาทีแรก
- visual (0-10): มีภาพที่หยุดนิ้ว (before/after, เห็นผลทันที, แปลกตา)
- multi (0-10): เล่าได้หลาย angle ทำซ้ำได้หลายคลิป
- hook: ประโยคภาษาไทยสำหรับ 3 วินาทีแรก
- angles: 2-3 มุมเล่าสั้นๆ ภาษาไทย
- why: เหตุผลหนึ่งประโยค
สินค้า: ${JSON.stringify({ name: String(item.name).slice(0, 200), price: item.price, category: item.category || "" })}`;

  const tool = {
    name: "submit_score",
    description: "ส่งคะแนนความง่ายในการทำคลิปขายของสินค้า",
    input_schema: {
      type: "object",
      properties: {
        problem: { type: "number" }, visual: { type: "number" }, multi: { type: "number" },
        hook: { type: "string" }, angles: { type: "array", items: { type: "string" } }, why: { type: "string" },
      },
      required: ["problem", "visual", "multi", "hook", "angles", "why"],
    },
  };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 800, tools: [tool], tool_choice: { type: "tool", name: "submit_score" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { error: `AI error ${r.status}`, detail: t.slice(0, 300), status: 502 };
  }
  const j = await r.json();
  const s = (j.content || []).find((c) => c.type === "tool_use")?.input;
  if (!s) return { error: "AI ไม่ส่งคะแนนกลับมา", status: 502 };
  const clamp = (v) => Math.max(0, Math.min(10, +v || 0));
  const score = {
    problem: clamp(s.problem), visual: clamp(s.visual), multi: clamp(s.multi),
    hook: String(s.hook || ""), angles: (s.angles || []).slice(0, 3).map(String), why: String(s.why || ""),
    model: MODEL, at: Date.now(),
  };
  await writeJSON(cachePath, score);
  member.ai = { day, count: used + 1 };
  await saveMember(member);
  return { score, cached: false };
}
