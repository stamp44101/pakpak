// LINE bot webhook: members use ปั๊กปัก from the chat (top products, links, AI ideas).
// The LINE userId equals the member id because Login and Messaging API share the ปั๊กปัก provider.
import { verifySignature, reply, push, loading, LIFF_URL } from "../../../../lib/line";
import { getMember, saveMember, roster, seats, seatsLeft, isAdmin } from "../../../../lib/auth";
import { freeWelcome } from "../../../../lib/welcome";
import { addViews } from "../../../../lib/activity";
import { readJSON, writeJSON } from "../../../../lib/store";
import { rank, effPrice } from "../../../../lib/score";
import { scoreItem } from "../../../../lib/ai";
import { isPro, PRICE } from "../../../../lib/plan";
import { catalog, publicProduct, ownerProducts } from "../../../../lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const APP = process.env.APP_URL || "https://pakpak-two.vercel.app";
const img = (id, size = "") => (id ? `https://down-th.img.susercontent.com/file/${id}${size}` : "");
const baht = (n) => "฿" + Math.round(+n || 0).toLocaleString("en-US");
const ago = (t) => { const h = (Date.now() - t) / 3600e3; return h < 1 ? "ไม่ถึงชั่วโมงก่อน" : h < 24 ? `${Math.floor(h)} ชม.ก่อน` : `${Math.floor(h / 24)} วันก่อน`; };
const text = (t, quick) => ({ type: "text", text: t, ...(quick ? { quickReply: { items: quick } } : {}) });
const qr = (label, txt) => ({ type: "action", action: { type: "message", label: label.slice(0, 20), text: txt } });
const HELP_QR = () => [qr("ท็อป 5", "ท็อป"), qr("เลือกหมวด", "หมวด"), qr("ลิงก์ของฉัน", "ลิงก์"), qr("สถานะ", "สถานะ")];
// LINE opens links in its own browser; this makes it hand off to Safari/Chrome, which then opens the Shopee app.
const external = (u) => { try { const x = new URL(u); x.searchParams.set("openExternalBrowser", "1"); return x.toString(); } catch { return u; } };
const openApp = (label = "เปิดปั๊กปัก") => ({ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "uri", label, uri: LIFF_URL } });

export async function POST(req) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) return new Response("bad signature", { status: 401 });
  const { events = [] } = JSON.parse(raw || "{}");
  await Promise.all(events.map((e) => handle(e).catch(async (err) => {
    console.error("event", err);
    // Storage down (e.g. Blob suspended): still answer, replies cost no quota.
    if (e.replyToken && /blob/i.test(String(err?.message))) await reply(e.replyToken, text("🛠️ ปั๊กปักกำลังปรับปรุงระบบชั่วคราวครับ\nข้อมูลของคุณยังอยู่ครบ ไม่หายแน่นอน\nกลับมาใช้ได้เร็ว ๆ นี้ ลองใหม่อีกครั้งในภายหลังนะครับ 🙏")).catch(() => {});
  })));
  return Response.json({ ok: true });
}

async function handle(e) {
  if (!e.replyToken || e.source?.type !== "user") return;
  const uid = e.source.userId;
  const m = await getMember(uid);
  if (m && (!m.botSeenAt || Date.now() - m.botSeenAt > 864e5)) { m.botSeenAt = Date.now(); await saveMember(m); }

  // ---- buying Pro: choose plan → send slip → admin approves in /admin ----
  if (m && m.status !== "revoked") {
    if (e.type === "postback" && e.postback.data.startsWith("a=buy")) {
      const plan = new URLSearchParams(e.postback.data).get("p") === "year" ? "year" : "month";
      m.pendingOrder = { plan, at: Date.now() };
      await saveMember(m);
      return reply(e.replyToken, payInfo(plan));
    }
    if (e.type === "message" && e.message.type === "image" && m.pendingOrder && !m.pendingOrder.slipAt) {
      m.pendingOrder.slipAt = Date.now();
      await saveMember(m);
      notifyAdmins(m).catch(() => {});
      return reply(e.replyToken, text(`ได้รับสลิปแล้ว ขอบคุณครับ 🙏
แอดมินกำลังตรวจสอบ เปิดสิทธิ์ Pro ${m.pendingOrder.plan === "year" ? "1 ปี" : "1 เดือน"} แล้วจะแจ้งในแชทนี้ทันที`));
    }
    if (e.type === "message" && e.message.type === "text" && /^(อัปเกรด|อัพเกรด|ซื้อ|สมัคร pro|ต่ออายุ|pro$|แพ็ก|ราคา)/i.test(e.message.text.trim())) return reply(e.replyToken, buyCard(m));
  }

  if (!m || m.status !== "active") return reply(e.replyToken, await gate(m, e.type === "follow"));
  // First contact after moving from the waitlist to Free: say so once, with the limits.
  if (m.welcomeFree && !isPro(m)) {
    m.welcomeFree = false; await saveMember(m);
    return reply(e.replyToken, freeWelcome(m));
  }
  if (e.type === "follow") return reply(e.replyToken, text(`ยินดีต้อนรับ คุณ${m.name} 🐶\nกด "ท็อป 5 วันนี้" ที่เมนูด้านล่าง ได้ตะกร้าน่าทำคลิปทันที ใช้บนมือถือได้เลยไม่ต้องเปิดคอม`, HELP_QR()));

  // admin can preview the Free experience: "ดูแบบ free" / "ดูแบบ pro"
  const admin = await isAdmin(uid);
  if (admin && (m.plan !== "pro" || m.proUntil || m.pendingOrder)) { m.plan = "pro"; m.proUntil = null; m.pendingOrder = null; await saveMember(m); }
  const tt = e.type === "message" && e.message.type === "text" ? e.message.text.trim().toLowerCase() : "";
  if (admin && /^ดูแบบ\s*(free|pro)$/.test(tt)) {
    m.viewAsFree = tt.endsWith("free");
    await saveMember(m);
    return reply(e.replyToken, text(m.viewAsFree ? "โหมดทดสอบ: ตอนนี้บอทตอบคุณแบบผู้ใช้ Free (พิมพ์ \"ดูแบบ pro\" เพื่อกลับ)" : "กลับเป็น Pro แล้ว", HELP_QR()));
  }
  const pro = isPro(m) && !(admin && m.viewAsFree);
  let state = (await readJSON(`users/m_${uid}.json`)) || { products: {} };
  if (!pro || !Object.keys(state.products || {}).length) {
    // Free, or Pro without own scans yet: the shared catalog, product pages only
    const products = {};
    for (const list of Object.values(await catalog(pro ? 20 : 5))) for (const p of list) products[p.id] = publicProduct(p);
    state = { ...state, products, shared: true };
  }
  const all = Object.values(state.products || {});
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];

  if (e.type === "postback") {
    const q = new URLSearchParams(e.postback.data);
    if (q.get("a") === "ai") return aiIdea(e, m, state, q.get("id"));
    if (q.get("a") === "top") return reply(e.replyToken, await top(all, q.get("c"), cats, { m, pro, state }));
    return;
  }
  if (e.type !== "message" || e.message.type !== "text") return;
  const t = e.message.text.trim();

  if (/^(วิธีเอาลิงก์|เอาลิงก์ยังไง)/.test(t)) return reply(e.replyToken, [text(LINK_INTRO), linkHowto()]);
  if (/^(วิธีใช้|ช่วยเหลือ|help)/i.test(t)) return reply(e.replyToken, howto());
  if (state.shared && /^(ลิงก์|ลิ้ง|link)/i.test(t)) return reply(e.replyToken, [text(`เอาลิงก์ของคุณเองได้จากมือถือ 4 ขั้น เลื่อนดูได้เลย 👉\nอยากได้ลิงก์อัตโนมัติทุกตัว ${pro ? "เปิดขั้นสูงบนคอม (กด \"วิธีใช้\")" : "เป็นขั้นสูงของแพ็ก Pro (พิมพ์ \"อัปเกรด\")"}`), linkHowto()]);
  if (/^(ติดต่อแอดมิน|แอดมิน)/.test(t)) return reply(e.replyToken, text("รับเรื่องแล้วครับ พิมพ์รายละเอียดทิ้งไว้ได้เลย แอดมินจะตอบกลับในแชทนี้ 🙏"));
  if (!all.length) return reply(e.replyToken, { type: "flex", altText: "ยังไม่มีข้อมูลตะกร้า", contents: card("ยังไม่มีข้อมูลตะกร้า", "คลังกลางกำลังอัปเดต ลองใหม่อีกสักครู่ หรือพิมพ์ \"ติดต่อแอดมิน\"", [openApp("เปิดปั๊กปัก")]) });

  const pasted = pastedLink(t);
  if (pasted) return reply(e.replyToken, pasted);
  const cm = t.match(/^(?:ท็อป|top|ท๊อป)\s*\d*\s*(.*)$/i);
  if (cm) return reply(e.replyToken, await top(all, cm[1].trim(), cats, { m, pro, state }));
  if (cats.includes(t)) return reply(e.replyToken, await top(all, t, cats, { m, pro, state }));
  const sm = t.match(/^(?:หา|ค้นหา|ค้น|search)\s+(.+)$/i);
  if (sm) return reply(e.replyToken, await top(all, sm[1].trim(), cats, { m, pro, state }));
  if (/^หมวด/.test(t)) return reply(e.replyToken, text("เลือกหมวดที่อยากดูท็อป 5", cats.slice(0, 13).map((c) => qr(c, "ท็อป " + c))));
  if (/^(ลิงก์|ลิ้ง|link)/i.test(t)) return reply(e.replyToken, links(all));
  if (/^สถานะ/.test(t)) return reply(e.replyToken, status(all, cats, state, m, pro));
  if (t.length >= 12) {
    const head = t.toLowerCase().slice(0, 18);
    const hit = all.find((p) => (p.name || "").toLowerCase().startsWith(head) || (p.name || "").toLowerCase().includes(head));
    if (hit) return reply(e.replyToken, [text(`ตัวนี้เลือกมาดีแล้วครับ 👍\n\nแบ่งหน้าที่กันแบบนี้นะ\n• ปั๊กปัก = เลือกตะกร้าที่น่าทำคลิปให้\n• ลิงก์ = คุณกดเองในแอป Shopee (ค่าคอมถึงจะเข้าบัญชีคุณ)\n\nวางชื่อสินค้าในแชทนี้ บอทสร้างลิงก์ให้ไม่ได้ ทำตาม 4 ขั้นนี้ได้เลย 👇`), linkHowto()]);
  }
  return reply(e.replyToken, text(`พิมพ์ได้แบบนี้ครับ\n• ท็อป — 5 ตะกร้าน่าทำคลิปที่สุด\n• ท็อป ห้องครัว — เฉพาะหมวด\n• หมวด — เลือกหมวด\n• หา สายนาฬิกา — ค้นสินค้าที่อยากทำ\n• ลิงก์ — ลิงก์ affiliate ที่สร้างแล้ว\n• สถานะ — ข้อมูลอัปเดตล่าสุดเมื่อไร`, HELP_QR()));
}

// "เอาลิงก์ของตัวเอง" in 4 steps, from a real screen recording (images in /public/howto)
const LINK_STEPS = [
  ["กด \"เปิดลิงก์\"", "แอป Shopee จะเปิดขึ้นมา"],
  ["กด “Allow”", "(ถ้ามีกล่องเด้งขึ้นมา)"],
  ["กดปุ่มแชร์ ↗", "อยู่มุมขวาบน"],
  ["กด \"คัดลอกลิงก์\"", "เสร็จแล้ว! เอาไปปักตะกร้าได้เลย"],
];
const LINK_INTRO = "วิธีการใช้ ปั๊กปัก\nสร้างลิงก์ง่ายๆ ใน 4 ขั้นตอน\n\nเราเลือกสินค้าให้ คุณแค่กดลิงก์ในหน้า Shopee คุณเอง 👇";
// Someone pasted a Shopee link into the chat: tell them what it is and what to do next.
function pastedLink(t) {
  const u = (t.match(/https?:\/\/\S+/) || [])[0];
  if (!u || !/(shopee\.co\.th|shp\.ee)/i.test(u)) return null;
  if (/s\.shopee\.co\.th|shp\.ee/i.test(u))
    return text(`✅ นี่คือลิงก์ที่คุณกดแชร์จากแอป Shopee แล้ว ใช้ได้เลยครับ\n\nเอาไปปักตะกร้า / ใส่ในคลิปหรือแคปชันได้ทันที ถ้าแอป Shopee ล็อกอินบัญชีที่สมัคร Shopee Affiliate ไว้ ค่าคอมจะเข้าบัญชีคุณ\n\nไม่ต้องส่งลิงก์ให้บอทนะครับ ปั๊กปักมีหน้าที่เลือกตะกร้าให้ ส่วนลิงก์คุณเก็บไว้ใช้เอง`, HELP_QR());
  return [text(`ลิงก์นี้เป็นลิงก์หน้าสินค้าธรรมดา ยังไม่ใช่ลิงก์ affiliate ของคุณครับ (กดซื้อผ่านลิงก์นี้ค่าคอมไม่เข้า)\n\nเอาลิงก์ของคุณ: เปิดสินค้าในแอป Shopee → กดแชร์ ↗ → คัดลอกลิงก์ ดูภาพ 4 ขั้นได้เลย 👇`), linkHowto()];
}

function linkHowto() {
  return { type: "flex", altText: "วิธีเอาลิงก์ของคุณ 4 ขั้น", contents: { type: "carousel", contents: LINK_STEPS.map(([title, body], i) => ({
    type: "bubble", size: "kilo",
    hero: { type: "image", url: `${APP}/howto/step${i + 1}.jpg`, size: "full", aspectRatio: "1:1", aspectMode: "cover" },
    body: { type: "box", layout: "vertical", spacing: "xs", paddingAll: "14px", contents: [
      { type: "text", text: `ขั้น ${i + 1}/4`, size: "xs", color: "#E5480A", weight: "bold" },
      { type: "text", text: title, weight: "bold", size: "md", wrap: true },
      { type: "text", text: body, size: "xs", color: "#666666", wrap: true },
    ] },
    ...(i === 3 ? { footer: { type: "box", layout: "vertical", contents: [{ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "ลองเลย: ท็อป 5 วันนี้", text: "ท็อป" } }] } } : {}),
  })) } };
}

function howto() {
  return { type: "flex", altText: "วิธีใช้ปั๊กปัก", contents: {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: "เริ่มใช้บนมือถือ 🐶", weight: "bold", size: "lg" },
      { type: "text", wrap: true, size: "sm", color: "#555555", text: "1) กด \"ท็อป 5 วันนี้\" ที่เมนูด้านล่าง\n2) กด \"ให้ AI ดู\" เพื่อเอา hook 3 วิแรก + มุมเล่าคลิป\n3) กด \"เปิดในแอป Shopee\" → ปุ่มแชร์ ↗ → คัดลอกลิงก์ = ลิงก์ affiliate ของคุณ" },
      { type: "separator", margin: "md" },
      { type: "text", text: "ขั้นสูง (ไม่บังคับ)", weight: "bold", size: "sm", margin: "md" },
      { type: "text", wrap: true, size: "xs", color: "#888888", text: "อยากได้ลิงก์อัตโนมัติทุกตัว หรือสแกนหมวดที่คุณทำเอง ใช้คอม + Chrome + ล็อกอิน Shopee ราว 3 นาที" },
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "ท็อป 5 วันนี้", text: "ท็อป" } },
      { type: "button", style: "secondary", height: "sm", action: { type: "message", label: "ดูวิธีเอาลิงก์ (4 ขั้น)", text: "วิธีเอาลิงก์" } },
      { type: "button", style: "link", height: "sm", action: { type: "uri", label: "ขั้นสูง (คอม)", uri: `${APP}/connector` } },
    ] },
  } };
}

// Not a member yet, or waiting for a seat.
async function gate(m, isFollow) {
  if (m?.status === "waitlist") {
    const r = await roster();
    const pos = r.waitlist.indexOf(m.id) + 1;
    return { type: "flex", altText: "อยู่ในคิว Early Access", contents: card("คุณอยู่ในคิว Early Access", `ลำดับที่ ${pos || "-"} · เมื่อมีที่ว่าง ปั๊กปักจะเปิดสิทธิ์ให้ หรือสมัคร Pro เพื่อใช้ได้ทันทีไม่ต้องรอคิว`, [{ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "สมัคร Pro ใช้ได้ทันที", text: "อัปเกรด Pro" } }, openApp("ดูสถานะ")]) };
  }
  if (m?.status === "revoked") return text("บัญชีนี้ถูกระงับการใช้งาน หากคิดว่าผิดพลาด พิมพ์ \"ติดต่อแอดมิน\" ได้เลยครับ");
  const r = await roster();
  const left = seatsLeft(r);
  const body = left > 0 ? `Early Access เหลือ ${left} ที่ สมัครด้วย LINE แล้วใช้งานได้ทันที` : "สมัครด้วย LINE แล้วใช้ฟรีได้ทันที (ท็อป 5/หมวด · AI 3 ครั้ง/วัน)";
  return { type: "flex", altText: "สมัครใช้ปั๊กปัก", contents: card(isFollow ? "ยินดีต้อนรับสู่ปั๊กปัก 🐶" : "ใช้งานได้หลังสมัครสมาชิก", `ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น\n${body}`, [openApp(left > 0 ? "สมัคร Early Access" : "สมัครใช้ฟรี")]) };
}

function card(title, body, buttons) {
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: title, weight: "bold", size: "lg", wrap: true },
      { type: "text", text: body, size: "sm", color: "#666666", wrap: true },
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: buttons },
  };
}

function pickCat(all, want, cats) {
  if (want) return cats.find((c) => c === want) || cats.find((c) => c.includes(want) || want.includes(c));
  // default: the category updated most recently
  return all.reduce((b, p) => ((p.fetchedAt || 0) > (b?.fetchedAt || 0) ? p : b), null)?.category;
}

async function top(all, want, cats, ctx = {}) {
  const c = pickCat(all, want, cats);
  if (!c) return notInCatalog(want, cats, ctx);
  const list = rank(all.filter((p) => p.category === c)).slice(0, 5);
  addViews(list.length).catch(() => {});
  const newest = Math.max(...all.filter((p) => p.category === c).map((p) => p.fetchedAt || 0));
  const others = cats.filter((x) => x !== c).slice(0, 12).map((x) => qr(x, "ท็อป " + x));
  return [
    text(`ท็อป 5 หมวด "${c}" · ข้อมูล ${ago(newest)}${list.some((p) => p.affLink) ? "" : "\nเอาลิงก์ของคุณ: กด \"เปิดในแอป Shopee\" → แชร์ ↗ → คัดลอกลิงก์ (พิมพ์ \"วิธีเอาลิงก์\" ดูภาพ 4 ขั้น)"}`),
    { type: "flex", altText: `ท็อป 5 ${c}`, contents: { type: "carousel", contents: list.map((p, i) => bubble(p, i + 1)) }, ...(others.length ? { quickReply: { items: others } } : {}) },
  ];
}

// Asked for a category the catalog doesn't have (e.g. "ท็อป สายนาฬิกา"):
// log the demand for the admin, show any matching products we do have, and point to Pro's own search.
async function notInCatalog(want, cats, { m, pro, state } = {}) {
  const kw = want.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
  logRequest(kw, m?.id).catch(() => {});
  const pool = state?.shared ? (await ownerProducts()).map(publicProduct) : Object.values(state?.products || {});
  const words = kw.split(" ").filter((w) => w.length > 1);
  const hits = rank(pool.filter((p) => { const n = (p.name || "").toLowerCase(); return words.length && words.every((w) => n.includes(w)); })).slice(0, pro ? 5 : 3);
  const pick = cats.slice(0, 13).map((x) => qr(x, "ท็อป " + x));
  const out = [];
  if (hits.length) {
    out.push(text(`ยังไม่มีหมวด "${want}" แต่เจอ ${hits.length} ตัวที่ตรงคำนี้ในคลังกลาง 👇`));
    out.push({ type: "flex", altText: `สินค้า ${want}`, contents: { type: "carousel", contents: hits.map((p, i) => bubble(p, i + 1)) } });
  }
  if (pro) {
    out.push({ type: "flex", altText: `ค้นหา "${want}" เอง`, contents: card(hits.length ? `อยากได้ "${want}" ครบทุกตัว?` : `ยังไม่มีหมวด "${want}"`,
      `แพ็ก Pro ของคุณค้นคำนี้จาก Shopee ได้เอง เปิดปั๊กปักบนคอมที่ติดตั้ง Connector แล้วพิมพ์ "${want}" ในช่องค้นหา ระบบจัดอันดับและสร้างลิงก์ให้`,
      [{ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "uri", label: "วิธีตั้งค่าบนคอม", uri: `${APP}/connector` } }]), quickReply: { items: pick } });
  } else {
    out.push({ ...buyCard(m, `ค้นหา "${want}" เองได้ใน Pro`), quickReply: { items: pick } });
    out.splice(out.length - 1, 0, text(`${hits.length ? "" : `ตอนนี้คลังกลางยังไม่มี "${want}" `}แพ็ก Free ดูได้เฉพาะท็อป 5 ของหมวดที่มีอยู่ ส่วน Pro ค้นสินค้าเฉพาะตัวที่คุณทำเองได้ จัดอันดับ + สร้างลิงก์ให้ทุกตัว\nแจ้งทีมไว้แล้วว่ามีคนอยากได้หมวดนี้ 🙏`));
  }
  return out.slice(0, 5);
}

// Count what people search for that isn't in the catalog (shown in /admin).
async function logRequest(kw, uid) {
  if (!kw) return;
  const r = (await readJSON("meta/requests.json")) || {};
  const x = r[kw] || { count: 0, users: [], first: Date.now() };
  x.count++; x.last = Date.now();
  if (uid && !x.users.includes(uid)) x.users.push(uid);
  r[kw] = x;
  await writeJSON("meta/requests.json", r);
}

function bubble(p, n) {
  const score = Math.round(p._t), max = p._a ? 100 : 60;
  const link = p.affLink || p.url;
  const buttons = [];
  if (p.affLink) {
    buttons.push({ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "clipboard", label: "คัดลอกลิงก์", clipboardText: p.affLink } });
    buttons.push({ type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "เปิดลิงก์", uri: p.affLink } });
  } else if (p.url) {
    // Free: get your OWN affiliate link from the Shopee app (product page → share → copy)
    buttons.push({ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "uri", label: "เปิดลิงก์", uri: external(p.url) } });
    buttons.push({ type: "button", style: "secondary", height: "sm", action: { type: "message", label: "ดูวิธีเอาลิงก์ 4 ขั้น", text: "วิธีเอาลิงก์" } });
  }
  buttons.push({ type: "button", style: "link", height: "sm", action: { type: "postback", label: p.ai ? "ดูไอเดียคลิป" : "ให้ AI ดู", data: `a=ai&id=${p.id}`, displayText: `ไอเดียคลิป #${n}` } });
  return {
    type: "bubble", size: "kilo",
    ...(p.image ? { hero: { type: "image", url: img(p.image), size: "full", aspectRatio: "1:1", aspectMode: "cover", ...(link ? { action: { type: "uri", uri: link } } : {}) } } : {}),
    body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "14px", contents: [
      { type: "box", layout: "horizontal", contents: [
        { type: "text", text: `#${n}`, weight: "bold", color: "#FE6A0E", size: "sm", flex: 0 },
        { type: "text", text: `คะแนน ${score}/${max}${p._a ? "" : " · ยังไม่มี AI"}`, size: "xs", color: "#888888", align: "end" },
      ] },
      { type: "text", text: p.name || "-", weight: "bold", size: "sm", wrap: true, maxLines: 2 },
      { type: "text", text: `${baht(effPrice(p))} · คอม ${(+p.commission || 0).toFixed(0)}% · ได้ ~${baht(p._perOrder)}/ออเดอร์`, size: "xs", color: "#555555", wrap: true },
      { type: "text", text: `ขายแล้ว ${(+p.sold || 0).toLocaleString("en-US")} · ⭐ ${(+p.rating || 0).toFixed(1)}${p.affLink ? " · มีลิงก์" : ""}`, size: "xs", color: "#888888", wrap: true },
      ...(!p.affLink && p.url ? [{ type: "box", layout: "vertical", margin: "sm", paddingAll: "8px", cornerRadius: "8px", backgroundColor: "#FFF1E7", contents: [
        { type: "text", text: "✓ ปั๊กปักเลือกตะกร้าให้แล้ว", size: "xxs", color: "#333333", weight: "bold", wrap: true },
        { type: "text", text: "ลิงก์ = คุณกดเองในแอป Shopee: แชร์ ↗ → คัดลอกลิงก์", size: "xxs", color: "#E5480A", wrap: true },
      ] }] : []),
    ] },
    footer: { type: "box", layout: "vertical", spacing: "xs", contents: buttons },
  };
}

const thDate = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

// Plan picker. Shown from the rich menu ("อัปเกรด Pro"), typed keywords, or Free-only features.
function buyCard(m, why) {
  const isProNow = isPro(m);
  const head = why || (isProNow ? "ต่ออายุ Pro" : "อัปเกรดเป็น Pro");
  const sub = isProNow
    ? (m.proUntil ? `Pro ของคุณใช้ได้ถึง ${thDate(m.proUntil)} ต่ออายุแล้ววันจะบวกต่อจากเดิม` : "บัญชีนี้เป็น Pro ไม่หมดอายุ")
    : "• ดูได้ทุกตัว ไม่ใช่แค่ท็อป 5\n• AI ไอเดียคลิปวันละ 30 ตัว (Free 3)\n• ขั้นสูง: ลิงก์อัตโนมัติ + สแกนหมวดของคุณเอง";
  const opt = (label, price, note, p, primary) => ({
    type: "box", layout: "horizontal", paddingAll: "12px", cornerRadius: "10px", backgroundColor: primary ? "#FFF1E7" : "#F7F7F7",
    action: { type: "postback", label, data: `a=buy&p=${p}`, displayText: `สมัคร Pro ${label}` },
    contents: [
      { type: "box", layout: "vertical", flex: 3, contents: [{ type: "text", text: label, weight: "bold", size: "md" }, { type: "text", text: note, size: "xs", color: "#888888" }] },
      { type: "text", text: price, weight: "bold", size: "lg", color: "#E5480A", align: "end", gravity: "center", flex: 2 },
    ],
  });
  return { type: "flex", altText: head, contents: {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: head, weight: "bold", size: "lg", wrap: true },
      { type: "text", text: sub, size: "sm", color: "#666666", wrap: true },
      { type: "text", text: "เลือกแพ็ก", size: "xs", color: "#999999", margin: "lg" },
      opt("รายเดือน", `฿${PRICE.month}`, "ใช้ได้ 30 วัน", "month", false),
      opt("รายปี", `฿${PRICE.year.toLocaleString("en-US")}`, "ใช้ได้ 1 ปี · ได้ฟรี 2 เดือน", "year", true),
    ] },
  } };
}

function payInfo(plan) {
  const amount = (plan === "year" ? PRICE.year : PRICE.month).toLocaleString("en-US");
  return [
    text(`แพ็ก Pro ${plan === "year" ? "รายปี" : "รายเดือน"} ยอด ฿${amount}\n\n1) สแกน QR พร้อมเพย์ด้านล่าง ร้าน ปั๊กปัก รับได้ทุกธนาคาร\n2) โอน ฿${amount} แล้วส่งรูปสลิปในแชทนี้\n\nแอดมินตรวจแล้วเปิดสิทธิ์ให้ ระบบจะแจ้งในแชทนี้ทันที`),
    { type: "image", originalContentUrl: `${APP}/pay-qr.jpg`, previewImageUrl: `${APP}/pay-qr-preview.jpg` },
  ];
}

async function notifyAdmins(m) {
  const r = await roster();
  const msg = text(`💰 มีสลิปใหม่\n${m.name} · Pro ${m.pendingOrder.plan === "year" ? "รายปี ฿" + PRICE.year.toLocaleString("en-US") : "รายเดือน ฿" + PRICE.month}\nตรวจสลิปในแชท OA แล้วกดอนุมัติที่ ${APP}/admin`);
  await Promise.all(r.admins.map((id) => push(id, msg)));
}

function links(all) {
  const ls = all.filter((p) => p.affLink).sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0)).slice(0, 15);
  if (!ls.length) return text("ยังไม่มีลิงก์ที่สร้างไว้ สแกนหมวดบนคอมแล้วระบบจะสร้างลิงก์ Top 20 ให้อัตโนมัติครับ", HELP_QR());
  return text(`ลิงก์ล่าสุด ${ls.length} อัน\n\n` + ls.map((p, i) => `${i + 1}. ${(p.name || "").slice(0, 40)}\n${p.affLink}`).join("\n\n"), HELP_QR());
}

function status(all, cats, state, m, pro) {
  const plan = pro ? `แพ็ก Pro${m.earlyAccess ? " (Early Access)" : ""}${m.proUntil ? ` ถึง ${new Date(m.proUntil).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}` : "แพ็ก Free · ดูท็อป 5 จากคลังกลาง";
  if (state.shared) return text(`${plan}\nหมวดในคลังกลาง: ${cats.join(", ")}\n\n${pro ? "อยากได้ลิงก์อัตโนมัติหรือสแกนหมวดเอง กด \"วิธีใช้\" → ขั้นสูง (คอม)" : "พิมพ์ \"อัปเกรด\" เพื่อดูสิทธิ์ Pro"}`, HELP_QR());
  const newest = Math.max(0, ...all.map((p) => p.fetchedAt || 0));
  const lines = cats.map((c) => { const ps = all.filter((p) => p.category === c); return `• ${c}: ${ps.length} ตัว · ลิงก์ ${ps.filter((p) => p.affLink).length} · ${ago(Math.max(...ps.map((p) => p.fetchedAt || 0)))}`; });
  return text(`${plan}\nบัญชี Shopee: ${state.account || "-"}\nอัปเดตล่าสุด ${newest ? ago(newest) : "-"}\n\n${lines.join("\n")}\n\nข้อมูลเกิน 3 วัน แนะนำเปิดคอมที่มี Connector แล้วกด "อัปเดตตอนนี้"`, HELP_QR());
}

async function aiIdea(e, m, state, id) {
  const p = state.products?.[id];
  if (!p) return reply(e.replyToken, text("ไม่พบสินค้านี้แล้ว ลองพิมพ์ \"ท็อป\" ใหม่ครับ"));
  let s = p.ai;
  if (!s) {
    loading(e.source.userId, 20).catch(() => {});
    const r = await scoreItem(m, { id: p.id, name: p.name, price: effPrice(p), category: p.category });
    if (r.error) return reply(e.replyToken, text(r.error));
    s = r.score;
    // save into the member's state so the web app shows it too
    const cur = (await readJSON(`users/m_${m.id}.json`)) || state;
    if (cur.products?.[id]) { cur.products[id] = { ...cur.products[id], ai: s }; cur.updatedAt = Date.now(); await writeJSON(`users/m_${m.id}.json`, cur); }
  }
  const msg = `🎬 ${(p.name || "").slice(0, 60)}\n\nAI: โชว์ปัญหา ${s.problem}/10 · ภาพหยุดนิ้ว ${s.visual}/10 · ต่อยอดหลายคลิป ${s.multi}/10\n\nHook 3 วิแรก\n"${s.hook}"\n\nมุมเล่า\n${(s.angles || []).map((a) => "• " + a).join("\n")}\n\nเหตุผล: ${s.why}`;
  const out = [text(msg, HELP_QR())];
  return reply(e.replyToken, out);
}
