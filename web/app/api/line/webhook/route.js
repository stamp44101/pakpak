// LINE bot webhook: members use ปั๊กปัก from the chat (top products, links, AI ideas).
// The LINE userId equals the member id because Login and Messaging API share the ปั๊กปัก provider.
import { verifySignature, reply, push, loading, LIFF_URL } from "../../../../lib/line";
import { getMember, saveMember, roster, seats, isAdmin } from "../../../../lib/auth";
import { readJSON, writeJSON } from "../../../../lib/store";
import { rank, effPrice } from "../../../../lib/score";
import { scoreItem } from "../../../../lib/ai";
import { isPro, PRICE } from "../../../../lib/plan";
import { catalog, publicProduct } from "../../../../lib/catalog";

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
  await Promise.all(events.map((e) => handle(e).catch((err) => console.error("event", err))));
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
  if (e.type === "follow") return reply(e.replyToken, text(`ยินดีต้อนรับกลับ คุณ${m.name} 🐶\nพิมพ์ "ท็อป" เพื่อดูตะกร้าที่น่าทำคลิปที่สุด หรือกดปุ่มด้านล่าง`, HELP_QR()));

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
    if (q.get("a") === "top") return reply(e.replyToken, top(all, q.get("c"), cats));
    return;
  }
  if (e.type !== "message" || e.message.type !== "text") return;
  const t = e.message.text.trim();

  if (/^(วิธีใช้|ช่วยเหลือ|help)/i.test(t)) return reply(e.replyToken, howto());
  if (!pro && /^(ลิงก์|ลิ้ง|link)/i.test(t)) return reply(e.replyToken, buyCard(m, "ลิงก์ affiliate อัตโนมัติเป็นฟีเจอร์ Pro"));
  if (/^(ติดต่อแอดมิน|แอดมิน)/.test(t)) return reply(e.replyToken, text("รับเรื่องแล้วครับ พิมพ์รายละเอียดทิ้งไว้ได้เลย แอดมินจะตอบกลับในแชทนี้ 🙏"));
  if (!all.length) return reply(e.replyToken, { type: "flex", altText: "ยังไม่มีข้อมูลตะกร้า", contents: card("ยังไม่มีข้อมูลตะกร้า", "สแกนหมวดแรกบนคอมที่ติดตั้ง Connector ก่อน แล้วกลับมาพิมพ์ \"ท็อป\" ในแชทนี้ได้เลย", [openApp("ไปสแกนหมวดแรก")]) });

  const cm = t.match(/^(?:ท็อป|top|ท๊อป)\s*\d*\s*(.*)$/i);
  if (cm) return reply(e.replyToken, top(all, cm[1].trim(), cats));
  if (cats.includes(t)) return reply(e.replyToken, top(all, t, cats));
  if (/^หมวด/.test(t)) return reply(e.replyToken, text("เลือกหมวดที่อยากดูท็อป 5", cats.slice(0, 13).map((c) => qr(c, "ท็อป " + c))));
  if (/^(ลิงก์|ลิ้ง|link)/i.test(t)) return reply(e.replyToken, links(all));
  if (/^สถานะ/.test(t)) return reply(e.replyToken, status(all, cats, state, m, pro));
  return reply(e.replyToken, text(`พิมพ์ได้แบบนี้ครับ\n• ท็อป — 5 ตะกร้าน่าทำคลิปที่สุด\n• ท็อป ห้องครัว — เฉพาะหมวด\n• หมวด — เลือกหมวด\n• ลิงก์ — ลิงก์ affiliate ที่สร้างแล้ว\n• สถานะ — ข้อมูลอัปเดตล่าสุดเมื่อไร`, HELP_QR()));
}

function howto() {
  return { type: "flex", altText: "วิธีใช้ปั๊กปัก", contents: {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: "วิธีใช้ปั๊กปัก 🐶", weight: "bold", size: "lg" },
      { type: "text", wrap: true, size: "sm", color: "#555555", text: "1) บนคอม: ติดตั้ง Connector แล้วล็อกอิน Shopee Affiliate ใน Chrome\n2) เปิดปั๊กปัก กดหมวดเพื่อสแกน ระบบสร้างลิงก์ Top 20 ให้เอง\n3) บนมือถือ: กด \"ท็อป 5 วันนี้\" ในแชทนี้ ก๊อปลิงก์ไปปักตะกร้าได้เลย\n4) กด \"ให้ AI ดู\" เพื่อเอา hook 3 วิแรก + มุมเล่าคลิป" },
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "uri", label: "ติดตั้ง Connector (คอม)", uri: `${APP}/connector` } },
      { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "เปิดปั๊กปัก", uri: LIFF_URL } },
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
  const left = Math.max(0, seats() - r.active.length);
  const body = left > 0 ? `Early Access เหลือ ${left} ที่ สมัครด้วย LINE แล้วใช้งานได้ทันที` : "Early Access เต็มแล้ว สมัครไว้เพื่อเข้าคิวได้ครับ";
  return { type: "flex", altText: "สมัครใช้ปั๊กปัก", contents: card(isFollow ? "ยินดีต้อนรับสู่ปั๊กปัก 🐶" : "ใช้งานได้หลังสมัครสมาชิก", `ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น\n${body}`, [openApp(left > 0 ? "สมัคร Early Access" : "สมัครเข้าคิว")]) };
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

function top(all, want, cats) {
  const c = pickCat(all, want, cats);
  if (!c) return text(`ไม่พบหมวด "${want}" ลองเลือกจากนี้ครับ`, cats.slice(0, 13).map((x) => qr(x, "ท็อป " + x)));
  const list = rank(all.filter((p) => p.category === c)).slice(0, 5);
  const newest = Math.max(...all.filter((p) => p.category === c).map((p) => p.fetchedAt || 0));
  const others = cats.filter((x) => x !== c).slice(0, 12).map((x) => qr(x, "ท็อป " + x));
  return [
    text(`ท็อป 5 หมวด "${c}" · ข้อมูล ${ago(newest)}${list.some((p) => p.affLink) ? "" : "\n\nเอาลิงก์ของคุณเองได้จากมือถือเลย ไม่ต้องใช้คอม:\n1) กด \"เปิดในแอป Shopee\"\n2) ในหน้าสินค้า กดปุ่มแชร์ ↗ มุมขวาบน\n3) คัดลอกลิงก์ = ลิงก์ affiliate ของคุณ (ต้องล็อกอินแอปด้วยบัญชีที่สมัคร affiliate)"}`),
    { type: "flex", altText: `ท็อป 5 ${c}`, contents: { type: "carousel", contents: list.map((p, i) => bubble(p, i + 1)) }, ...(others.length ? { quickReply: { items: others } } : {}) },
  ];
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
    buttons.push({ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "uri", label: "เปิดในแอป Shopee", uri: external(p.url) } });
    buttons.push({ type: "button", style: "secondary", height: "sm", action: { type: "clipboard", label: "คัดลอกลิงก์สินค้า", clipboardText: p.url } });
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
      ...(!p.affLink && p.url ? [{ type: "text", text: "เปิดในแอป → กดแชร์ ↗ → คัดลอกลิงก์ = ลิงก์ของคุณเอง", size: "xxs", color: "#E5480A", wrap: true }] : []),
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
    : "• สแกนหมวดและคำค้นเองไม่จำกัด\n• ลิงก์ affiliate Top 20 อัตโนมัติ ก๊อปในแชทได้ทันที\n• AI ไอเดียคลิปวันละ 30 ตัว (Free 3)";
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
  if (state.shared) return text(`${plan}\nหมวดในคลังกลาง: ${cats.join(", ")}\n\n${pro ? "ติดตั้ง Connector บนคอม (กด \"วิธีใช้\") เพื่อสแกนหมวดของคุณเองและได้ลิงก์อัตโนมัติ" : "พิมพ์ \"อัปเกรด\" เพื่อดูสิทธิ์ Pro"}`, HELP_QR());
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
