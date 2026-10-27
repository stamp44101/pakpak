// AI clipability scoring. Uses the platform's Anthropic key (server-side only).
export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บน server" }, { status: 500 });
  const { items } = await req.json().catch(() => ({}));
  if (!Array.isArray(items) || !items.length) return Response.json({ error: "no items" }, { status: 400 });
  const list = items.slice(0, 12).map((i) => ({ id: String(i.id), name: String(i.name).slice(0, 160), price: i.price, category: i.category || "" }));

  const prompt = `คุณเป็นครีเอเตอร์ทำคลิปสั้น 9:16 ปักตะกร้า Shopee ในไทย ประเมินสินค้าแต่ละตัวว่าทำคลิปขายได้ง่ายแค่ไหน
ให้คะแนน 0-10:
- problem: โชว์ปัญหา→ทางแก้ได้ใน 3 วินาทีแรก
- visual: มีภาพที่หยุดนิ้ว (before/after, เห็นผลทันที, แปลกตา)
- multi: เล่าได้หลาย angle ทำซ้ำได้หลายคลิป
พร้อม hook ภาษาไทยหนึ่งประโยคสำหรับ 3 วินาทีแรก, angles 2-3 ข้อสั้นๆ, why เหตุผลหนึ่งประโยค
ตอบเป็น JSON array เท่านั้น: [{"id","problem","visual","multi","hook","angles":[],"why"}]
สินค้า: ${JSON.stringify(list)}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) return Response.json({ error: "AI error " + r.status }, { status: 502 });
  const j = await r.json();
  const text = (j.content || []).map((c) => c.text || "").join("");
  const m = text.match(/\[[\s\S]*\]/);
  let out = [];
  try { out = JSON.parse(m ? m[0] : text); } catch { return Response.json({ error: "AI ตอบไม่เป็น JSON" }, { status: 502 }); }
  const scores = out.map((s) => ({
    id: String(s.id), problem: +s.problem || 0, visual: +s.visual || 0, multi: +s.multi || 0,
    hook: String(s.hook || ""), angles: (s.angles || []).slice(0, 3).map(String), why: String(s.why || ""),
  }));
  return Response.json({ scores });
}
