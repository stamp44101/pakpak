// AI clipability score for ONE product. Results are cached per product for every user,
// so a product that anyone has scored before costs nothing to score again.
import { readJSON, writeJSON, userKey, unauthorized } from "../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

export async function POST(req) {
  if (!userKey(req)) return unauthorized();
  const { item, refresh } = (await req.json().catch(() => ({}))) || {};
  const id = String(item?.id || "");
  if (!/^\d+_\d+$/.test(id) || !item.name) return Response.json({ error: "ข้อมูลสินค้าไม่ครบ" }, { status: 400 });

  const cachePath = `ai/${id}.json`;
  if (!refresh) {
    const cached = await readJSON(cachePath);
    if (cached) return Response.json({ score: cached, cached: true });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บน server" }, { status: 500 });

  const prompt = `คุณเป็นครีเอเตอร์ทำคลิปสั้น 9:16 ปักตะกร้า Shopee ในไทย ประเมินว่าสินค้านี้ทำคลิปขายได้ง่ายแค่ไหน
ให้คะแนน 0-10:
- problem: โชว์ปัญหา→ทางแก้ได้ใน 3 วินาทีแรก
- visual: มีภาพที่หยุดนิ้ว (before/after, เห็นผลทันที, แปลกตา)
- multi: เล่าได้หลาย angle ทำซ้ำได้หลายคลิป
พร้อม hook ภาษาไทยหนึ่งประโยคสำหรับ 3 วินาทีแรก, angles 2-3 ข้อสั้นๆ, why เหตุผลหนึ่งประโยค
ตอบเป็น JSON object เท่านั้น: {"problem","visual","multi","hook","angles":[],"why"}
สินค้า: ${JSON.stringify({ name: String(item.name).slice(0, 200), price: item.price, category: item.category || "" })}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) return Response.json({ error: "AI error " + r.status }, { status: 502 });
  const j = await r.json();
  const text = (j.content || []).map((c) => c.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  let s;
  try { s = JSON.parse(m ? m[0] : text); } catch { return Response.json({ error: "AI ตอบไม่เป็น JSON" }, { status: 502 }); }
  const score = {
    problem: +s.problem || 0, visual: +s.visual || 0, multi: +s.multi || 0,
    hook: String(s.hook || ""), angles: (s.angles || []).slice(0, 3).map(String), why: String(s.why || ""),
    model: MODEL, at: Date.now(),
  };
  await writeJSON(cachePath, score);
  return Response.json({ score, cached: false });
}
