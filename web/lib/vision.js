// ถ่ายรูปหาตะกร้า: a member sends a product photo in the LINE chat → Claude (same model as lib/ai.js) names the
// product type + 3–5 Thai keywords → we search the shared catalog with the member's rights (lib/access.js) and
// reply a carousel. Nothing found → "not in the catalog yet" + the keyword is logged as demand, like "หา <คำ>".
//
// Behind the photoSearch flag (lib/flags.js photoSearchFor). Replies only — never push.
// AI use counts on member.ai together with lib/ai.js (one daily allowance, view.rules.aiPerDay).
// New data lives only under vision/… ; members/* keeps its format (only the existing `ai` counter moves).
import { reply, loading, botFetch } from "./line";
import { readJSON, updateJSON } from "./store";
import { memberPath } from "./auth";
import { MODEL } from "./ai";
import { ownerProducts, publicProduct } from "./catalog";
import { rank } from "./score";
import { chooseCat, todayCat, bkkDay, RULES } from "./access";
import { flags, setFlag, photoSearchLabel } from "./flags";
import { ago } from "./fmt";
import { text, qr, HELP_QR, bubble, buyCard, external } from "./bot/ui";

const MAX_BYTES = 5 * 1024 * 1024; // Anthropic's per-image limit
const SHOW = { pro: 5, free: 3 };

// ---- admin switch, like "ล็อกท็อป": "รูปหาตะกร้า" (status) · "รูปหาตะกร้า admin" · "รูปหาตะกร้า 20" · "รูปหาตะกร้า off"
// `tt` is the lowercased, trimmed message. Returns a reply message, or null when it isn't this command.
export async function photoCommand(tt, uid) {
  const pm = tt.match(/^(?:รูปหาตะกร้า|ถ่ายรูปหาตะกร้า|photosearch|photo)\s*(off|ปิด|admin|แอดมิน|\d{1,3})?$/);
  if (!pm) return null;
  const raw = pm[1];
  if (raw) {
    const n = Math.min(100, +raw || 0);
    const v = /^(admin|แอดมิน)$/.test(raw) ? "admin" : n > 0 ? String(n) : "off";
    await setFlag("photoSearch", v, uid);
  }
  const f = await flags();
  return text(`📷 ถ่ายรูปหาตะกร้า: ${photoSearchLabel(f.photoSearch)}${f.photoSearchAt ? `\nเปลี่ยนล่าสุด ${ago(f.photoSearchAt)}` : ""}\n\nสั่งได้: "รูปหาตะกร้า admin" (แอดมินเท่านั้น ทั้งแบบ free/pro) · "รูปหาตะกร้า 20" (20% ของผู้ใช้) · "รูปหาตะกร้า 100" · "รูปหาตะกร้า off" (ย้อนกลับทันที)\nมีผลกับทุกคนภายใน ~30 วิ`, HELP_QR());
}

// ---- the photo → carousel flow. `view`, `state`, `cats` are what route.js already built for this member.
// Returns whatever reply() returned. Throws only before anything was sent (route.js then replies FALLBACK).
export async function photoSearch(e, m, { view, state, cats }) {
  const uid = e.source.userId;
  // Several photos sent at once arrive as one event each: answer the first only, so one send = one AI use.
  if (e.message.imageSet && e.message.imageSet.index > 1) return;

  loading(uid, 20).catch(() => {});
  const img = await botFetch(`message/${e.message.id}/content`, { data: true, method: "GET" }).catch(() => null);
  const buf = img?.ok ? Buffer.from(await img.arrayBuffer()) : null;
  if (!buf?.length) return reply(e.replyToken, text("ขอโทษค่ะ เปิดรูปนี้ไม่ได้ ลองส่งรูปใหม่อีกครั้งนะคะ (ไม่เสียโควตา AI)", HELP_QR()));
  if (buf.length > MAX_BYTES) return reply(e.replyToken, text("รูปใหญ่เกินไปค่ะ ลองครอปให้เห็นสินค้าชัดๆ แล้วส่งใหม่ (ไม่เสียโควตา AI)", HELP_QR()));
  const type = mediaType(img.headers.get("content-type"), buf);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return reply(e.replyToken, text("ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บน server", HELP_QR()));

  // One daily AI allowance shared with ไอเดียคลิป (member.ai). Reserved first, given back if the AI fails.
  const day = bkkDay();
  const lim = view.rules.aiPerDay;
  const got = await takeAi(m, day, lim);
  if (!got) return reply(e.replyToken, view.pro
    ? text(`วันนี้ใช้ AI ครบ ${lim} ครั้งแล้ว พรุ่งนี้ส่งรูปหาตะกร้าได้อีกค่ะ`, HELP_QR())
    : [text(`แพ็ก Free ใช้ AI ได้วันละ ${lim} ครั้ง (รวมไอเดียคลิปและถ่ายรูปหาตะกร้า) ครบแล้ววันนี้ค่ะ\nพรุ่งนี้ใช้ต่อได้ หรืออัปเกรด Pro ใช้ได้วันละ ${RULES.pro.aiPerDay} ครั้ง`), buyCard(m)]);

  let seen;
  try {
    seen = await readPhoto(key, buf.toString("base64"), type, cats);
  } catch (err) {
    await giveAi(m, day).catch(() => {});
    throw err;
  }
  if (seen.error) {
    await giveAi(m, day).catch(() => {});
    return reply(e.replyToken, text(`ขอโทษค่ะ AI อ่านรูปไม่สำเร็จ ลองส่งใหม่อีกครั้งได้เลย (ไม่เสียโควตา AI)`, HELP_QR()));
  }
  if (seen.kind !== "product" || !seen.keywords.length) {
    await giveAi(m, day).catch(() => {});
    if (seen.kind === "slip") return reply(e.replyToken, [text("รูปนี้เหมือนสลิปโอนเงินค่ะ ถ้าจะสมัคร Pro กดเลือกแพ็กด้านล่างก่อน แล้วส่งสลิปอีกครั้งนะคะ 🙏"), buyCard(m)]);
    return reply(e.replyToken, text("ไม่เห็นสินค้าในรูปนี้ค่ะ 📷 ลองถ่ายให้เห็นตัวสินค้าชัดๆ หรือแคปหน้าสินค้ามา แล้วส่งใหม่ได้เลย (ไม่เสียโควตา AI)", HELP_QR()));
  }

  const { msgs, found } = await answer(seen, m, view, state, cats, lim - (m.ai?.day === day ? m.ai.count : lim));
  const sent = await reply(e.replyToken, msgs);
  logPhoto(m.id, seen, found).catch(() => {});
  return sent;
}

// The reply for a reading { type, keywords, category }. `left` = AI uses left today (for the footer line).
async function answer(seen, m, view, state, cats, left) {
  const want = seen.type || seen.keywords[0];
  const pro = !!view.pro;
  // The member's rights, as "หา <คำ>" uses them (route.js notInCatalog) — Free never sees locked ranks.
  const pool = view.rules.oneCat
    ? Object.values(state.products || {}) // Free V2: only what this member may see, one category a day (below)
    : state.shared ? (await ownerProducts()).filter((p) => !state.lockedIds?.has(p.id)).map(publicProduct)
    : Object.values(state.products || {}); // Pro with own scans: their own data (cards and "เอาลิงก์ของฉัน" work on it)
  let hits = matchProducts(pool, seen);

  // Free V2: results from one category only — the one already chosen today, or this becomes it.
  let first = false;
  if (view.rules.oneCat && hits.length) {
    const cur = todayCat(m);
    const c = cur && hits.some((p) => p.category === cur) ? cur : hits[0].category;
    const day = await chooseCat(m, c, view);
    if (!day.ok) return { found: hits.length, msgs: [
      text(`📷 รูปนี้น่าจะเป็น "${want}" เจอในหมวด "${c}" ค่ะ\nแต่วันนี้คุณเลือกหมวด "${day.cat}" แล้ว แพ็ก Free ดูได้วันละ 1 หมวด พรุ่งนี้ดูหมวดนี้ได้\nอยากดูตอนนี้เลย อัปเกรด Pro ดูได้ทุกหมวด`, [qr(`ดู ${day.cat}`, `ท็อป ${day.cat}`), qr("🔥 มาแรง", "มาแรง")]),
      buyCard(m),
    ] };
    first = !!day.first;
    hits = hits.filter((p) => p.category === c);
  }

  const quota = left != null && left !== Infinity && left >= 0 ? `\nAI วันนี้เหลือ ${left} ครั้ง` : "";
  const kws = seen.keywords.join(", ");
  if (!hits.length) {
    // Free V1: maybe it is in the catalog, but only among the locked top 5.
    const locked = !pro && state.shared && state.lockedIds?.size
      ? matchProducts((await ownerProducts()).filter((p) => state.lockedIds.has(p.id)), seen).length : 0;
    if (locked) return { found: 0, msgs: [
      text(`📷 รูปนี้น่าจะเป็น "${want}"\n🔒 ตรงกับ ${locked} ตะกร้าในท็อป 1–5 ที่ปลดล็อคได้เฉพาะผู้ใช้งาน Pro${quota}`),
      buyCard(m, `ดูตะกร้า "${want}" ในท็อป 1–5 ได้ใน Pro`),
    ] };
    await logDemand(want, m.id).catch(() => {});
    const q = shopeeQuery(seen);
    return { found: 0, msgs: [
      text(`📷 รูปนี้น่าจะเป็น "${want}" (คีย์เวิร์ด: ${kws})\nตอนนี้คลังกลางยังไม่มีสินค้านี้ค่ะ แจ้งทีมไว้แล้วว่ามีคนอยากได้ 🙏${quota}`),
      { type: "flex", altText: `ค้นหา "${q}" ใน Shopee`.slice(0, 400), contents: shopeeBubble(q, `ยังไม่มีในคลัง ค้น "${q}" ใน Shopee แทน`), quickReply: { items: HELP_QR() } },
    ] };
  }

  const n = pro ? SHOW.pro : SHOW.free;
  const list = hits.slice(0, n);
  const more = !pro && hits.length > n ? `\nแพ็ก Pro เห็นได้ถึง ${SHOW.pro} ตัว` : "";
  return { found: hits.length, msgs: [
    text(`📷 รูปนี้น่าจะเป็น "${want}" (คีย์เวิร์ด: ${kws})\nเจอ ${list.length} ตะกร้าที่ใกล้เคียงในคลังกลาง 👇${first ? `\n📌 หมวดของวันนี้: "${list[0].category}" (แพ็ก Free ดูได้วันละ 1 หมวด)` : ""}${more}${quota}`),
    { type: "flex", altText: `ตะกร้าที่ใกล้เคียง "${want}"`.slice(0, 400), contents: { type: "carousel", contents: [...list.map((p, i) => bubble(p, i + 1)), shopeeBubble(shopeeQuery(seen), "ไม่ใช่ตัวที่ถ่าย? ค้นใน Shopee")] }, quickReply: { items: HELP_QR() } },
  ] };
}

// ---- not in the catalog (or not the right one): open Shopee's search with the photo's keywords. The member picks a
// product there, shares its link back into this chat, and the existing pasted-link flow makes their own aff link.
// Search terms: the most specific keyword (often the brand) + the type, e.g. "sasi แป้งฝุ่น".
export const shopeeQuery = ({ type = "", keywords = [] }) => [...new Set([keywords[0], type].map((x) => String(x || "").trim()).filter(Boolean))].join(" ").slice(0, 60);
export const shopeeSearchUrl = (q) => external(`https://shopee.co.th/search?keyword=${encodeURIComponent(q)}`);
// kilo, like bubble(): a carousel must not mix sizes.
export const shopeeBubble = (q, title) => ({
  type: "bubble", size: "kilo",
  body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "14px", contents: [
    { type: "text", text: "🔍 " + title, weight: "bold", size: "sm", wrap: true },
    { type: "text", text: "1) กดค้นใน Shopee แล้วเลือกสินค้า\n2) กด แชร์ → คัดลอกลิงก์\n3) วางลิงก์ในแชทนี้ บอทแปลงเป็นลิงก์แอฟของคุณให้", size: "xs", color: "#555555", wrap: true },
  ] },
  footer: { type: "box", layout: "vertical", contents: [
    { type: "button", style: "primary", color: "#EE4D2D", height: "sm", action: { type: "uri", label: "ค้นใน Shopee", uri: shopeeSearchUrl(q) } },
  ] },
});

// ---- search: products whose name (or scanned keyword) contains the photo's keywords; most keywords first,
// then the catalog score. A product must match at least one keyword — the category alone is too loose.
export function matchProducts(pool, { type = "", keywords = [], category = "" }) {
  const words = [...new Set([type, ...keywords].map(norm).filter((w) => w.length > 1))];
  if (!words.length) return [];
  const scored = [];
  for (const p of pool) {
    const name = norm(p.name), kw = norm(p.keyword);
    let hit = 0;
    for (const w of words) if (name.includes(w) || (kw && (kw.includes(w) || w.includes(kw)))) hit++;
    if (hit) scored.push({ p, s: hit * 2 + (category && p.category === category ? 1 : 0) });
  }
  const order = new Map(scored.map((x) => [x.p.id, x.s]));
  return rank(scored.map((x) => x.p)).sort((a, b) => order.get(b.id) - order.get(a.id) || b._t - a._t);
}
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// The model's answer, cleaned: kind product|slip|other, short Thai type, 3–5 keywords, a known category or "".
export function parseReading(s, cats = []) {
  const kind = ["product", "slip", "other"].includes(s?.kind) ? s.kind : "other";
  const clean = (x) => String(x || "").replace(/["“”\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
  const keywords = [...new Set((Array.isArray(s?.keywords) ? s.keywords : []).map(clean).filter((w) => w.length > 1))].slice(0, 5);
  const category = cats.includes(s?.category) ? s.category : "";
  return { kind, type: clean(s?.type), keywords, category };
}

async function readPhoto(key, b64, type, cats) {
  const tool = {
    name: "submit_product",
    description: "ส่งผลว่าในรูปเป็นสินค้าอะไร",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["product", "slip", "other"] },
        type: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        category: { type: "string" },
      },
      required: ["kind", "type", "keywords", "category"],
    },
  };
  const prompt = `ดูรูปนี้แล้วส่งผลผ่าน tool submit_product
- kind: "product" ถ้าในรูปมีสินค้าที่ขายบน Shopee ได้ · "slip" ถ้าเป็นสลิปโอนเงิน · "other" อย่างอื่น (เซลฟี่ วิว แคปแชท ฯลฯ)
- type: ประเภทสินค้าภาษาไทยสั้นๆ แบบที่คนพิมพ์ค้นใน Shopee เช่น "สายนาฬิกา" "พัดลมพกพา"
- keywords: คีย์เวิร์ดภาษาไทย 3-5 คำ ที่น่าจะอยู่ในชื่อสินค้าบน Shopee เรียงจากตรงที่สุด คำละ 1-2 พยางค์ถึงวลีสั้น (ใส่ชื่อแบรนด์/อังกฤษได้ถ้าเห็นชัดในรูป)
- category: เลือกหมวดที่ตรงที่สุดจากรายการนี้ ถ้าไม่ตรงเลยให้ส่ง "": ${JSON.stringify(cats.slice(0, 40))}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(20e3),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 600, tools: [tool], tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: type, data: b64 } }, { type: "text", text: prompt }] }],
    }),
  }).catch((err) => ({ ok: false, status: 0, text: async () => String(err) }));
  if (!r.ok) {
    console.error("vision AI", r.status, (await r.text().catch(() => "")).slice(0, 300));
    return { error: `AI error ${r.status}` };
  }
  const j = await r.json();
  const s = (j.content || []).find((c) => c.type === "tool_use")?.input;
  if (!s) return { error: "AI ไม่ส่งข้อมูลกลับมา" };
  return parseReading(s, cats);
}

// LINE sends JPEG for photos; trust the bytes over the header.
export function mediaType(header, buf) {
  if (buf?.[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf?.[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf?.[0] === 0x52 && buf[8] === 0x57) return "image/webp";
  if (buf?.[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  const h = String(header || "").split(";")[0].trim();
  return /^image\/(jpeg|png|gif|webp)$/.test(h) ? h : "image/jpeg";
}

// ---- quota on member.ai (same field and shape lib/ai.js counts on). Atomic, so two photos can't both pass.
async function takeAi(m, day, lim) {
  let ok = false;
  const next = await updateJSON(memberPath(m.id), (cur) => {
    const used = cur.ai?.day === day ? cur.ai.count : 0;
    ok = used < lim;
    return ok ? { ...cur, ai: { day, count: used + 1 } } : cur;
  }, () => m);
  m.ai = next.ai;
  return ok;
}
async function giveAi(m, day) {
  const next = await updateJSON(memberPath(m.id), (cur) => (cur.ai?.day === day && cur.ai.count > 0 ? { ...cur, ai: { day, count: cur.ai.count - 1 } } : cur), () => m);
  m.ai = next.ai;
}

// ---- demand: the same document and shape as "หา <คำ>" (route.js logRequest), shown in /admin.
async function logDemand(want, uid) {
  const kw = norm(want).slice(0, 40);
  if (!kw) return;
  await updateJSON("meta/requests.json", (r) => {
    const x = r[kw] ? { ...r[kw], users: [...(r[kw].users || [])] } : { count: 0, users: [], first: Date.now() };
    x.count++; x.last = Date.now();
    if (uid && !x.users.includes(uid)) x.users.push(uid);
    return { ...r, [kw]: x };
  });
}

// ---- new data, new path only: one log per Bangkok day, to judge the test (vision/log/YYYY-MM-DD.json).
async function logPhoto(uid, seen, found) {
  await updateJSON(`vision/log/${bkkDay()}.json`, (cur) => ({ list: [...(cur.list || []), { uid, at: Date.now(), type: seen.type, keywords: seen.keywords, category: seen.category, found }].slice(-1000) }));
}
export const photoLog = (day = bkkDay()) => readJSON(`vision/log/${day}.json`);
