// AI clipability score for ONE product, shared by the web app and the LINE bot.
// Results are cached per product for every user, so a product anyone scored before is free.
import { createHash } from "crypto";
import { readJSON, writeJSON, updateJSON } from "./store";
import { memberPath } from "./auth";
import { planOf } from "./plan";
import { viewOf, RULES } from "./access";
import { ownerProducts } from "./catalog";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// The shared cache is keyed by product id, but the product's name comes from the caller. Each cached score
// remembers which name it was written for (`n`), and is only served for that same name — otherwise a member
// could send a made-up name for a real id and have the AI's answer to it shown to everyone else.
// Scores saved before this check have no `n` and are still served.
const nameText = (name) => String(name || "").slice(0, 200);
export const nameKey = (name) => createHash("sha256").update(nameText(name)).digest("hex").slice(0, 16);
export const scoreFor = (cached, name) => (cached && (!cached.n || cached.n === nameKey(name)) ? cached : null);
// The shared score of a product, for callers that read the cache themselves (LINE bot).
export const cachedScore = async (p) => scoreFor(await readJSON(`ai/${p.id}.json`), p.name);

// Returns { score, cached } or { error, status }.
export async function scoreItem(member, item0, refresh = false) {
  const id = String(item0?.id || "");
  if (!/^\d+_\d+$/.test(id) || !item0.name) return { error: "ข้อมูลสินค้าไม่ครบ", status: 400 };
  // A product of the shared catalog is scored from the catalog's own name/category, never from what the caller sent.
  const own = (await ownerProducts().catch(() => [])).find((p) => p.id === id);
  const item = own?.name ? { ...item0, name: own.name, category: own.category || item0.category } : item0;
  const cachePath = `ai/${id}.json`;
  // A cached idea that was saved cut off (before the 30 Oct fix) is redone on us: no daily limit, no count.
  let repair = false;
  if (!refresh) {
    const cached = scoreFor(await readJSON(cachePath), item.name);
    if (cached && complete(cached)) return { score: cached, cached: true };
    repair = !!cached;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บน server", status: 500 };

  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // Bangkok date
  const DAILY = (await viewOf(member)).rules.aiPerDay; // new (uncached) scores per member per day
  // Reserved in the database before the AI is called (given back if it fails), so requests sent at the same
  // moment can't all pass the limit on the same stale count.
  if (!repair && !(await takeAi(member, day, DAILY))) return { error: planOf(member) === "pro" ? `วันนี้ให้ AI ให้คะแนนครบ ${DAILY} ตัวแล้ว พรุ่งนี้ใช้ต่อได้` : `แพ็ก Free ให้ AI ได้วันละ ${DAILY} ตัว ครบแล้ว อัปเกรด Pro เพื่อใช้ได้วันละ ${RULES.pro.aiPerDay} ตัว`, status: 429, upgrade: planOf(member) !== "pro" };

  const prompt = `คุณเป็นครีเอเตอร์ทำคลิปสั้น 9:16 ปักตะกร้า Shopee ในไทย ประเมินว่าสินค้านี้ทำคลิปขายได้ง่ายแค่ไหน แล้วส่งผลผ่าน tool submit_score
- problem (0-10): โชว์ปัญหา→ทางแก้ได้ใน 3 วินาทีแรก
- visual (0-10): มีภาพที่หยุดนิ้ว (before/after, เห็นผลทันที, แปลกตา)
- multi (0-10): เล่าได้หลาย angle ทำซ้ำได้หลายคลิป
- hook: ประโยคภาษาไทยสำหรับ 3 วินาทีแรก
- angles: 2-3 มุมเล่าสั้นๆ ภาษาไทย
- why: เหตุผลหนึ่งประโยค
สินค้า: ${JSON.stringify({ name: nameText(item.name), price: item.price, category: item.category || "" })}`;

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
  const a = await askTool(key, tool, prompt).catch((err) => ({ error: "AI ไม่ส่งข้อมูลกลับมา", detail: String(err?.message || err).slice(0, 300), status: 502 }));
  if (a.error) { if (!repair) await giveAi(member, day).catch(() => {}); return a; }
  const s = a.input;
  const clamp = (v) => Math.max(0, Math.min(10, +v || 0));
  const score = {
    problem: clamp(s.problem), visual: clamp(s.visual), multi: clamp(s.multi),
    hook: String(s.hook || ""), angles: angleList(s.angles), why: String(s.why || ""),
    model: MODEL, at: Date.now(), n: nameKey(item.name),
  };
  await writeJSON(cachePath, score);
  return { score, cached: false };
}

// ---- Pro: personal extra ideas per product (up to IDEA_EXTRA on top of the shared one) ----
// The shared score above is the same for everyone who opens a product; these are private to one member,
// stored at ideas/<memberId>/<productId>.json, and each one is told to avoid every hook/angle already given.
export const IDEA_EXTRA = 4;
const ideasPath = (m, id) => `ideas/${m.id}/${id}.json`;

// Thai text is token-heavy: a low max_tokens cut the tool input mid-way (hook arrived, angles/why didn't — 30 Oct bug).
// Ask with room to spare; if the answer is still cut or incomplete, ask once more. Never accept a partial idea.
export const angleList = (a) => (Array.isArray(a) ? a : typeof a === "string" ? a.split(/\n|•/) : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
export const complete = (s) => !!(s && String(s.hook || "").trim() && angleList(s.angles).length >= 2 && String(s.why || "").trim());
async function askTool(key, tool, prompt, extra = {}) {
  let last = { error: "AI ไม่ส่งข้อมูลกลับมา", status: 502 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, ...extra, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) { last = { error: `AI error ${r.status}`, detail: (await r.text().catch(() => "")).slice(0, 300), status: 502 }; continue; }
    const j = await r.json();
    const s = (j.content || []).find((c) => c.type === "tool_use")?.input;
    if (j.stop_reason !== "max_tokens" && complete(s)) return { input: s };
    last = { error: "AI ตอบไม่ครบ ลองใหม่อีกครั้งได้เลย (ไม่เสียโควตา)", status: 502 };
  }
  return last;
}

export async function myIdeas(member, id) {
  if (!/^\d+_\d+$/.test(String(id || ""))) return [];
  return (((await readJSON(ideasPath(member, id))) || {}).list || []).filter(complete); // drop ideas saved cut-off before 30 Oct fix
}

// Returns { idea, list, left } or { error, status, upgrade }.
export async function moreIdea(member, item) {
  const id = String(item?.id || "");
  if (!/^\d+_\d+$/.test(id) || !item.name) return { error: "ข้อมูลสินค้าไม่ครบ", status: 400 };
  const view = await viewOf(member);
  if (!view.pro) return { error: `ไอเดียส่วนตัวเพิ่มอีก ${IDEA_EXTRA} แบบต่อตะกร้า สำหรับ Pro เท่านั้น — คนอื่นจะไม่ได้ hook ซ้ำกับคุณ`, status: 403, upgrade: true };
  const list = await myIdeas(member, id);
  if (list.length >= IDEA_EXTRA) return { error: `ตะกร้านี้ขอไอเดียครบ ${IDEA_EXTRA + 1} แบบแล้ว`, status: 429, list, left: 0 };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บน server", status: 500 };
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  if (!(await takeAi(member, day, view.rules.aiPerDay))) return { error: `วันนี้ใช้ AI ครบ ${view.rules.aiPerDay} ครั้งแล้ว พรุ่งนี้ขอต่อได้`, status: 429, list, left: IDEA_EXTRA - list.length };

  const shared = scoreFor(await readJSON(`ai/${id}.json`), item.name);
  const before = [shared, ...list].filter(Boolean).map((x, i) => `${i + 1}. hook: "${x.hook}" · มุม: ${(x.angles || []).join(" / ")}`).join("\n");
  const prompt = `คุณเป็นครีเอเตอร์ทำคลิปสั้น 9:16 ปักตะกร้า Shopee ในไทย คิดไอเดียคลิปใหม่สำหรับสินค้านี้ แล้วส่งผ่าน tool submit_idea
สินค้า: ${JSON.stringify({ name: nameText(item.name), price: item.price, category: item.category || "" })}
${before ? `ไอเดียที่ให้ไปแล้ว ห้ามซ้ำทั้ง hook และมุมเล่า ให้เปลี่ยนวิธีเปิดคลิป กลุ่มคนดู หรือสถานการณ์ใช้งานไปเลย:\n${before}\n` : ""}- hook: ประโยคภาษาไทยสำหรับ 3 วินาทีแรก
- angles: 2-3 มุมเล่าสั้นๆ ภาษาไทย
- why: ทำไมไอเดียนี้น่าจะหยุดนิ้ว หนึ่งประโยค`;
  const tool = {
    name: "submit_idea", description: "ส่งไอเดียคลิปใหม่",
    input_schema: { type: "object", properties: { hook: { type: "string" }, angles: { type: "array", items: { type: "string" } }, why: { type: "string" } }, required: ["hook", "angles", "why"] },
  };
  const a = await askTool(key, tool, prompt, { temperature: 1 }).catch((err) => ({ error: "AI ไม่ส่งข้อมูลกลับมา", detail: String(err?.message || err).slice(0, 300), status: 502 }));
  if (a.error) { await giveAi(member, day).catch(() => {}); return a; }
  const s = a.input;
  const idea = { hook: String(s.hook), angles: angleList(s.angles), why: String(s.why || ""), at: Date.now() };
  const next = [...list, idea];
  await writeJSON(ideasPath(member, id), { list: next });
  return { idea, list: next, left: IDEA_EXTRA - next.length };
}

// Take one of today's AI calls if any is left (version-checked: two requests can't both take the last one, and
// fields another request changed meanwhile, e.g. aiSeen, are kept). Returns false when the day's limit is used up.
async function takeAi(member, day, limit) {
  let ok = false;
  const next = await updateJSON(memberPath(member.id), (cur) => {
    const used = cur.ai?.day === day ? cur.ai.count : 0;
    ok = used < limit;
    return ok ? { ...cur, ai: { day, count: used + 1 } } : cur;
  }, () => member);
  member.ai = next.ai;
  return ok;
}
// Give the call back when the AI failed.
async function giveAi(member, day) {
  const next = await updateJSON(memberPath(member.id), (cur) => (cur.ai?.day === day && cur.ai.count > 0 ? { ...cur, ai: { day, count: cur.ai.count - 1 } } : cur), () => member);
  member.ai = next.ai;
}
