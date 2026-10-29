// LINE bot UI: Flex cards and quick replies. No member data or rules here — just how messages look.
import { LIFF_URL } from "../line";
import { affLink, SHORT_NOTE } from "../afflink";
import { effPrice } from "../score";
import { isPro, ORDERS, orderOf, ORDER_TTL_H, PLANS, foundingOpen } from "../plan";
import { baht, thDate } from "../fmt";

export const APP = process.env.APP_URL || "https://pakpak-two.vercel.app";
export const img = (id, size = "") => (id ? `https://down-th.img.susercontent.com/file/${id}${size}` : "");
export const text = (t, quick) => ({ type: "text", text: t, ...(quick ? { quickReply: { items: quick } } : {}) });
export const qr = (label, txt) => ({ type: "action", action: { type: "message", label: label.slice(0, 20), text: txt } });
export const HELP_QR = () => [qr("🔥 มาแรง", "มาแรง"), qr("ท็อป 5", "ท็อป"), qr("เลือกหมวด", "หมวด"), qr("ลิงก์ของฉัน", "ลิงก์"), qr("สถานะ", "สถานะ")];
// LINE opens links in its own browser; this makes it hand off to Safari/Chrome, which then opens the Shopee app.
export const external = (u) => { try { const x = new URL(u); x.searchParams.set("openExternalBrowser", "1"); return x.toString(); } catch { return u; } };
export const openApp = (label = "เปิดปั๊กปัก") => ({ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "uri", label, uri: LIFF_URL } });

export function affResult(url, name, id, left = null) {
  const link = affLink(url, id);
  return [
    text(`✅ ลิงก์แอฟของคุณ (ID ${id})${name ? `\n${name.slice(0, 60)}` : ""}\n\n${link}\n\n${SHORT_NOTE}${left != null ? `\n\nวันนี้ทำลิงก์ได้อีก ${left} ลิงก์ (แพ็ก Free)` : ""}`, HELP_QR()),
    { type: "flex", altText: "ลิงก์แอฟของคุณ", contents: { type: "bubble", size: "kilo", body: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "clipboard", label: "คัดลอกลิงก์", clipboardText: link } },
      { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "ลองเปิดลิงก์", uri: external(link) } },
    ] } } },
  ];
}

export function howto() {
  return { type: "flex", altText: "วิธีใช้ปั๊กปัก", contents: {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: "เริ่มใช้บนมือถือ 🐶", weight: "bold", size: "lg" },
      { type: "text", wrap: true, size: "sm", color: "#555555", text: "1) กด \"ท็อป 5 วันนี้\" ที่เมนูด้านล่าง\n2) กด \"ให้ AI ดู\" เพื่อเอา hook 3 วิแรก + มุมเล่าคลิป\n3) กด \"เอาลิงก์ของฉัน\" → ส่ง Affiliate ID → ได้ลิงก์แอฟของคุณทันที (ต้องมี Affiliate ID เท่านั้น)" },
      { type: "separator", margin: "md" },
      { type: "text", text: "ขั้นสูง (ไม่บังคับ)", weight: "bold", size: "sm", margin: "md" },
      { type: "text", wrap: true, size: "xs", color: "#888888", text: "อยากได้ลิงก์อัตโนมัติทุกตัว หรือสแกนหมวดที่คุณทำเอง ใช้คอม + Chrome + ล็อกอิน Shopee ราว 3 นาที" },
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "ท็อป 5 วันนี้", text: "ท็อป" } },
      { type: "button", style: "link", height: "sm", action: { type: "uri", label: "ขั้นสูง (คอม)", uri: `${APP}/connector` } },
    ] },
  } };
}

export function card(title, body, buttons) {
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: title, weight: "bold", size: "lg", wrap: true },
      { type: "text", text: body, size: "sm", color: "#666666", wrap: true },
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: buttons },
  };
}

// First card of a carousel whose top ranks are locked for Free: rank, score and why it ranks high (see lib/access.js).
export function lockBubble(rows) {
  return {
    type: "bubble", size: "kilo",
    styles: { body: { backgroundColor: "#2B1E16" }, footer: { backgroundColor: "#2B1E16" } },
    body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents: [
      { type: "text", text: "🔒", size: "3xl", align: "center" },
      { type: "text", text: `ปลดล็อคตะกร้า Top ${rows.length}`, weight: "bold", size: "lg", color: "#FFFFFF", align: "center", wrap: true },
      { type: "text", text: "สำหรับผู้ใช้งาน Pro เท่านั้น", size: "sm", color: "#FFC9A6", align: "center", wrap: true },
      { type: "separator", margin: "lg", color: "#4A382C" },
      ...rows.map((r) => ({ type: "box", layout: "vertical", margin: "md", contents: [
        { type: "box", layout: "horizontal", contents: [
          { type: "text", text: `#${r.rank}`, weight: "bold", size: "sm", color: "#FE6A0E", flex: 0 },
          { type: "text", text: "▒▒▒▒▒▒", size: "sm", color: "#5C4636", flex: 3, margin: "md" },
          { type: "text", text: r.score ? `คะแนน ${r.score}/${r.max}` : "", size: "xxs", color: "#FFC9A6", align: "end", gravity: "center", flex: 3 },
        ] },
        ...(r.why?.length ? [{ type: "text", text: r.why.join(" · "), size: "xxs", color: "#FFC9A6", wrap: true, margin: "xs" }] : []),
      ] })),
    ] },
    footer: { type: "box", layout: "vertical", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "ปลดล็อคด้วย Pro", text: "อัปเกรด Pro" } },
    ] },
  };
}

export function bubble(p, n) {
  const score = Math.round(p._t), max = p._a ? 100 : 60;
  const link = p.affLink || p.url;
  const buttons = [];
  if (p.affLink) {
    buttons.push({ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "clipboard", label: "คัดลอกลิงก์", clipboardText: p.affLink } });
    buttons.push({ type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "เปิดลิงก์", uri: p.affLink } });
  } else if (p.url) {
    // No link yet: the member makes their own from their Affiliate ID
    buttons.push({ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "postback", label: "เอาลิงก์ของฉัน", data: `a=link&id=${p.id}`, displayText: `เอาลิงก์ #${n}` } });
    buttons.push({ type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "ดูหน้าสินค้า", uri: external(p.url) } });
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
      ...(p._cat && !p._perDay ? [{ type: "text", text: `หมวด ${p._cat}`, size: "xxs", color: "#E5480A", weight: "bold" }] : []),
      ...(p._perDay ? [{ type: "text", text: `🔥 ขายวันละ ~${Math.round(p._perDay).toLocaleString("en-US")} ชิ้น · ${p._boost >= 1.5 ? `เร็วกว่าปกติ ${p._boost.toFixed(1)} เท่า` : "ยอดกำลังขึ้น"}${p.category ? ` · ${p.category}` : ""}`, size: "xxs", color: "#E5480A", weight: "bold", wrap: true }] : []),
      { type: "text", text: p.name || "-", weight: "bold", size: "sm", wrap: true, maxLines: 2 },
      { type: "text", text: `${baht(effPrice(p))} · คอม ${(+p.commission || 0).toFixed(0)}% · ได้ ~${baht(p._perOrder)}/ออเดอร์`, size: "xs", color: "#555555", wrap: true },
      { type: "text", text: `ขายแล้ว ${(+p.sold || 0).toLocaleString("en-US")} · ⭐ ${(+p.rating || 0).toFixed(1)}${p.affLink ? " · มีลิงก์" : ""}`, size: "xs", color: "#888888", wrap: true },
      ...(!p.affLink && p.url ? [{ type: "box", layout: "vertical", margin: "sm", paddingAll: "8px", cornerRadius: "8px", backgroundColor: "#FFF1E7", contents: [
        { type: "text", text: "✓ ปั๊กปักเลือกตะกร้าให้แล้ว", size: "xxs", color: "#333333", weight: "bold", wrap: true },
        { type: "text", text: "ลิงก์แอฟของคุณ = ต้องมี Affiliate ID เท่านั้น", size: "xxs", color: "#E5480A", wrap: true },
      ] }] : []),
    ] },
    footer: { type: "box", layout: "vertical", spacing: "xs", contents: buttons },
  };
}

// Plan picker. Shown from the rich menu ("อัปเกรด Pro"), typed keywords, or Free-only features.
export function buyCard(m, why) {
  const isProNow = isPro(m);
  const head = why || (isProNow ? "ต่ออายุ Pro" : "อัปเกรดเป็น Pro");
  const sub = isProNow
    ? (m.proUntil ? `Pro ของคุณใช้ได้ถึง ${thDate(m.proUntil)} ต่ออายุแล้ววันจะบวกต่อจากเดิม` : "บัญชีนี้เป็น Pro ไม่หมดอายุ")
    : `• ปลดล็อคตะกร้า Top 5 ที่ล็อกไว้ (ท็อปรวม · มาแรง · รายหมวด)\n• ดูได้ทุกตัว ทุกหมวด ไม่จำกัดวันละ 1 หมวด\n• ทำลิงก์ด้วย Affiliate ID ไม่จำกัด\n• AI ไอเดียคลิปวันละ ${PLANS.pro.aiPerDay} ตัว\n• ขั้นสูง: ลิงก์อัตโนมัติ + สแกนหมวดของคุณเอง`;
  const founding = foundingOpen(m);
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
      ...(founding ? [
        { type: "text", text: m?.founding ? "🎁 ราคา Founding ของคุณ ใช้ได้ตลอดไป" : "🎁 ข้อเสนอพิเศษสำหรับคุณ: ราคา Founding ล็อกไว้ตลอดไป", size: "xs", color: "#E5480A", weight: "bold", wrap: true },
        opt(ORDERS.fmonth.label, baht(ORDERS.fmonth.price), `ปกติ ${baht(ORDERS.month.price)} · ใช้ได้ ${ORDERS.fmonth.days} วัน`, "fmonth", false),
        opt(ORDERS.fyear.label, baht(ORDERS.fyear.price), `ปกติ ${baht(ORDERS.year.price)} · ใช้ได้ ${ORDERS.fyear.span}`, "fyear", true),
      ] : [
        opt(ORDERS.month.label, baht(ORDERS.month.price), `ใช้ได้ ${ORDERS.month.days} วัน`, "month", false),
        opt(ORDERS.year.label, baht(ORDERS.year.price), `ใช้ได้ ${ORDERS.year.span} · ได้ฟรี 2 เดือน`, "year", true),
      ]),
    ] },
  } };
}

export function payInfo(plan) {
  const o = orderOf(plan), amount = o.price.toLocaleString("en-US");
  return [
    text(`แพ็ก Pro ${o.label} ยอด ฿${amount}\n\n1) สแกน QR พร้อมเพย์ด้านล่าง ร้าน ปั๊กปัก รับได้ทุกธนาคาร\n2) โอน ฿${amount} แล้วส่งรูปสลิปในแชทนี้ภายใน ${ORDER_TTL_H} ชม. (เกินเวลาคำสั่งซื้อจะถูกยกเลิก เลือกแพ็กใหม่ได้ตลอด)\n\nแอดมินตรวจแล้วเปิดสิทธิ์ให้ ระบบจะแจ้งในแชทนี้ทันที`),
    { type: "image", originalContentUrl: `${APP}/pay-qr.jpg`, previewImageUrl: `${APP}/pay-qr-preview.jpg` },
  ];
}

