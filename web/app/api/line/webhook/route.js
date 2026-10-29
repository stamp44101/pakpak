// LINE bot webhook: members use ปั๊กปัก from the chat (top products, links, AI ideas).
// The LINE userId equals the member id because Login and Messaging API share the ปั๊กปัก provider.
import { verifySignature, reply, push, loading, LIFF_URL, botFetch } from "../../../../lib/line";
import { getMember, ensureMember, saveMember, roster, seats, seatsLeft, isAdmin } from "../../../../lib/auth";
import { freeWelcome } from "../../../../lib/welcome";
import { notifyDiscord } from "../../../../lib/discord";
import { addViews } from "../../../../lib/activity";
import { readJSON, writeJSON } from "../../../../lib/store";
import { rank, effPrice } from "../../../../lib/score";
import { scoreItem } from "../../../../lib/ai";
import { isPro, PRICE, ORDER_TTL_H } from "../../../../lib/plan";
import { catalog, freeCatalog, publicProduct, ownerProducts } from "../../../../lib/catalog";
import { flags, setFlag, lockTop5For, lockLabel, bucket } from "../../../../lib/flags";
import { trending } from "../../../../lib/trending";
import { parseAffId, affLink, cleanProductUrl, isShortLink, resolveShortLink, AFF_ID_HOW, SHORT_NOTE } from "../../../../lib/afflink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const APP = process.env.APP_URL || "https://pakpak-two.vercel.app";
const img = (id, size = "") => (id ? `https://down-th.img.susercontent.com/file/${id}${size}` : "");
const baht = (n) => "฿" + Math.round(+n || 0).toLocaleString("en-US");
const ago = (t) => { const h = (Date.now() - t) / 3600e3; return h < 1 ? "ไม่ถึงชั่วโมงก่อน" : h < 24 ? `${Math.floor(h)} ชม.ก่อน` : `${Math.floor(h / 24)} วันก่อน`; };
const text = (t, quick) => ({ type: "text", text: t, ...(quick ? { quickReply: { items: quick } } : {}) });
const qr = (label, txt) => ({ type: "action", action: { type: "message", label: label.slice(0, 20), text: txt } });
const HELP_QR = () => [qr("🔥 มาแรง", "มาแรง"), qr("ท็อป 5", "ท็อป"), qr("เลือกหมวด", "หมวด"), qr("ลิงก์ของฉัน", "ลิงก์"), qr("สถานะ", "สถานะ")];
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
    if (e.replyToken && /blob/i.test(String(err?.message))) await reply(e.replyToken, text("🛠️ ปั๊กปักกำลังปรับปรุงระบบ!\n\nเนื่องจากได้รับความสนใจจากผู้ใช้งานเป็นจำนวนมาก เราจึงกำลังพัฒนาระบบให้รองรับการใช้งานได้ดียิ่งขึ้น เพื่อให้ทุกคนใช้งานสะดวกและรวดเร็วกว่าเดิม\n\nขออภัยในความไม่สะดวก และขอบคุณที่ให้การสนับสนุนปั๊กปักนะคะ 🙏")).catch(() => {});
  })));
  return Response.json({ ok: true });
}

async function handle(e) {
  if (!e.replyToken || e.source?.type !== "user") return;
  const uid = e.source.userId;
  let m = await getMember(uid);
  if (!m) {
    // Returning member after the database move (or a friend who never signed up): recreate from the LINE profile.
    const prof = await botFetch(`profile/${uid}`, { method: "GET" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (prof) m = await ensureMember(uid, { name: prof.displayName, picture: prof.pictureUrl });
  }
  if (m && (!m.botSeenAt || Date.now() - m.botSeenAt > 864e5)) { m.botSeenAt = Date.now(); await saveMember(m); }

  // ---- buying Pro: choose plan → send slip → admin approves in /admin ----
  if (m && m.status !== "revoked") {
    if (e.type === "postback" && e.postback.data.startsWith("a=buy")) {
      const plan = new URLSearchParams(e.postback.data).get("p") === "year" ? "year" : "month";
      const lockGroup = lockTop5For(await flags(), m);
      m.pendingOrder = { plan, at: Date.now(), ...(lockGroup ? { lockGroup: true } : {}) };
      await saveMember(m);
      const price = plan === "year" ? PRICE.year : PRICE.month;
      await Promise.all([
        reply(e.replyToken, payInfo(plan)),
        notifyDiscord("interest", { title: `🛒 เลือกแพ็ก Pro ${plan === "year" ? "รายปี" : "รายเดือน"} ฿${price.toLocaleString("en-US")}`, lines: [`**${m.name}** กำลังจะโอน${lockGroup ? " · กลุ่มทดสอบล็อกท็อป 5" : ""}`, `${APP}/admin`] }).catch(() => {}),
      ]);
      return;
    }
    if (e.type === "message" && e.message.type === "image" && !m.pendingOrder && m.orderExpired && Date.now() - m.orderExpired.expiredAt < 7 * 864e5) {
      m.pendingOrder = { plan: m.orderExpired.plan, at: m.orderExpired.at, late: true }; // slip came after the 24h window: still count it
      m.orderExpired = null;
    }
    if (e.type === "message" && e.message.type === "image" && m.pendingOrder && !m.pendingOrder.slipAt) {
      m.pendingOrder.slipAt = Date.now();
      await saveMember(m);
      const plan = m.pendingOrder.plan, price = plan === "year" ? PRICE.year : PRICE.month;
      const slip = await botFetch(`message/${e.message.id}/content`, { data: true, method: "GET" }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      await Promise.all([
        reply(e.replyToken, text(`ได้รับสลิปแล้ว ขอบคุณค่ะ 🙏
แอดมินกำลังตรวจสอบ เปิดสิทธิ์ Pro ${plan === "year" ? "1 ปี" : "1 เดือน"} แล้วจะแจ้งในแชทนี้ทันที`)),
        notifyAdmins(m).catch(() => {}),
        notifyDiscord("slip", { title: `💰 สลิปใหม่ ฿${price.toLocaleString("en-US")} · Pro ${plan === "year" ? "รายปี" : "รายเดือน"}`, lines: [`**${m.name}** ส่งสลิปแล้ว ตรวจยอดแล้วกดอนุมัติ`, `${APP}/admin`], image: slip }).catch(() => {}),
      ]);
      return;
    }
    if (e.type === "message" && e.message.type === "text" && /^(อัปเกรด|อัพเกรด|ซื้อ|สมัคร pro|ต่ออายุ|pro$|แพ็ก|ราคา)/i.test(e.message.text.trim())) return reply(e.replyToken, buyCard(m, null, lockTop5For(await flags(), m)));
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
  // Lock-top-5 test switch: "ล็อกท็อป" (status) · "ล็อกท็อป admin" · "ล็อกท็อป 20" (% of Free) · "ล็อกท็อป off" (rollback)
  const lm = admin && tt.match(/^ล็อกท็อป\s*(off|ปิด|admin|แอดมิน|\d{1,3})?$/);
  if (lm) {
    const raw = lm[1];
    if (raw) {
      const n = Math.min(100, +raw || 0);
      const v = /^(admin|แอดมิน)$/.test(raw) ? "admin" : n > 0 ? String(n) : "off";
      await setFlag("lockTop5", v, uid);
    }
    const f = await flags();
    return reply(e.replyToken, text(`🔒 ล็อกท็อป 5: ${lockLabel(f.lockTop5)}${f.lockTop5At ? `\nเปลี่ยนล่าสุด ${ago(f.lockTop5At)}` : ""}\n\nสั่งได้: "ล็อกท็อป admin" (ทดสอบเอง + "ดูแบบ free") · "ล็อกท็อป 20" (20% ของ Free) · "ล็อกท็อป 100" · "ล็อกท็อป off" (ย้อนกลับทันที)\nมีผลกับทุกคนภายใน ~30 วิ`, HELP_QR()));
  }
  const pro = isPro(m) && !(admin && m.viewAsFree);
  let state = (await readJSON(`users/m_${uid}.json`)) || { products: {} };
  if (!pro) {
    // Free: the shared catalog, product pages only (ranks 6–10 + locked teasers while the lock test is on)
    const fc = await freeCatalog(lockTop5For(await flags(), m, { adminPreview: admin && m.viewAsFree }));
    state = { ...state, products: fc.products, locked: fc.locked, lockedIds: fc.lockedIds, shared: true };
  } else if (!Object.keys(state.products || {}).length) {
    // Pro without own scans yet: the shared catalog
    const products = {};
    for (const list of Object.values(await catalog(20))) for (const p of list) products[p.id] = publicProduct(p);
    state = { ...state, products, shared: true };
  }
  const all = Object.values(state.products || {});
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];

  if (e.type === "postback") {
    const q = new URLSearchParams(e.postback.data);
    if (q.get("a") === "ai") return aiIdea(e, m, state, q.get("id"));
    if (q.get("a") === "top") return reply(e.replyToken, await top(all, q.get("c"), cats, { m, pro, state }));
    if (q.get("a") === "link") { const p = state.products?.[q.get("id")]; return reply(e.replyToken, await askAffId(m, p?.url, p?.name)); }
    return;
  }
  if (e.type !== "message" || e.message.type !== "text") return;
  const t = e.message.text.trim();

  // Waiting for this member's Affiliate ID (after "เอาลิงก์ของฉัน" or a pasted product link)
  if (m.awaitAff && Date.now() - m.awaitAff.at < 30 * 60e3 && !COMMAND.test(t) && !/https?:\/\//.test(t)) {
    const id = parseAffId(t);
    if (!id) return reply(e.replyToken, text(`ถ้าอยากได้ลิงก์แอฟของตัวเอง ต้องทราบ Affiliate ID ของตัวเองก่อนค่ะ\n\n${AFF_ID_HOW}\n\nพิมพ์เฉพาะตัวเลขส่งมาได้เลย`, idQR(m)));
    const { url, name } = m.awaitAff;
    m.affId = id; m.awaitAff = null; await saveMember(m);
    return reply(e.replyToken, affResult(url, name, id));
  }
  if (m.awaitAff) { m.awaitAff = null; await saveMember(m); }

  if (/^(วิธีเอาลิงก์|เอาลิงก์ยังไง)/.test(t)) return reply(e.replyToken, text(NEED_ID, HELP_QR()));
  if (/^(วิธีใช้|ช่วยเหลือ|help)/i.test(t)) return reply(e.replyToken, howto());
  if (state.shared && /^(ลิงก์|ลิ้ง|link)/i.test(t)) return reply(e.replyToken, text(NEED_ID, HELP_QR()));
  if (/^(ติดต่อแอดมิน|แอดมิน)/.test(t)) return reply(e.replyToken, text("รับเรื่องแล้วค่ะ พิมพ์รายละเอียดทิ้งไว้ได้เลย แอดมินจะตอบกลับในแชทนี้ 🙏"));
  if (!all.length) return reply(e.replyToken, { type: "flex", altText: "ยังไม่มีข้อมูลตะกร้า", contents: card("ยังไม่มีข้อมูลตะกร้า", "คลังกลางกำลังอัปเดต ลองใหม่อีกสักครู่ หรือพิมพ์ \"ติดต่อแอดมิน\"", [openApp("เปิดปั๊กปัก")]) });

  const pasted = await pastedLink(t, m);
  if (pasted) return reply(e.replyToken, pasted);
  if (/^(🔥\s*)?มาแรง/.test(t)) return reply(e.replyToken, await hot(state, pro));
  const cm = t.match(/^(?:ท็อป|top|ท๊อป)\s*\d*\s*(.*)$/i);
  // plain "ท็อป" (rich menu): one cross-category list — มาแรง when there is data, else each category's #1
  if (cm && !cleanWant(cm[1].trim())) return reply(e.replyToken, await hot(state, pro, { all, cats }));
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
    if (hit?.url && !hit.affLink) return reply(e.replyToken, await askAffId(m, hit.url, hit.name));
  }
  return reply(e.replyToken, text(`พิมพ์ได้แบบนี้ค่ะ\n• มาแรง — ตะกร้าที่ยอดขายกำลังพุ่ง ทุกหมวด\n• ท็อป — 5 ตะกร้าน่าทำคลิปที่สุด\n• ท็อป ห้องครัว — เฉพาะหมวด\n• หมวด — เลือกหมวด\n• หา สายนาฬิกา — ค้นสินค้าที่อยากทำ\n• ลิงก์ — ลิงก์ affiliate ที่สร้างแล้ว\n• สถานะ — ข้อมูลอัปเดตล่าสุดเมื่อไร`, HELP_QR()));
}

const COMMAND = /^(🔥|มาแรง|ท็อป|top|ท๊อป|หมวด|หา|ค้น|search|ลิงก์|ลิ้ง|link|สถานะ|วิธี|ช่วยเหลือ|help|ติดต่อ|แอดมิน|อัปเกรด|อัพเกรด|ซื้อ|สมัคร|ต่ออายุ|ราคา|แพ็ก|ดูแบบ)/i;
const NEED_ID = `อยากได้ลิงก์ affiliate ของตัวเอง ต้องมี Affiliate ID เท่านั้นค่ะ\n\nกด "เอาลิงก์ของฉัน" ใต้สินค้าที่อยากได้ หรือวางลิงก์สินค้า Shopee ในแชทนี้ แล้วส่ง Affiliate ID มา บอทแปลงเป็นลิงก์ของคุณให้ทันที\n\n${AFF_ID_HOW}`;
const idQR = (m) => [...(m.affId ? [qr(`ใช้ ${m.affId}`, m.affId)] : []), qr("ท็อป 5", "ท็อป")];

// Ask for the member's Affiliate ID, then the next message is their answer (see handle()).
async function askAffId(m, url, name) {
  if (!url || !cleanProductUrl(url)) return text("ขอโทษค่ะ สินค้านี้ไม่มีลิงก์ให้แปลง ลองตัวอื่นได้เลย", HELP_QR());
  m.awaitAff = { url, name: name || "", at: Date.now() };
  await saveMember(m);
  return text(`${name ? `🛒 ${name.slice(0, 60)}\n\n` : ""}ส่ง Affiliate ID ของคุณมาได้เลยค่ะ บอทจะแปลงเป็นลิงก์แอฟของคุณให้\n\n${AFF_ID_HOW}`, idQR(m));
}

function affResult(url, name, id) {
  const link = affLink(url, id);
  return [
    text(`✅ ลิงก์แอฟของคุณ (ID ${id})${name ? `\n${name.slice(0, 60)}` : ""}\n\n${link}\n\n${SHORT_NOTE}`, HELP_QR()),
    { type: "flex", altText: "ลิงก์แอฟของคุณ", contents: { type: "bubble", size: "kilo", body: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "clipboard", label: "คัดลอกลิงก์", clipboardText: link } },
      { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "ลองเปิดลิงก์", uri: external(link) } },
    ] } } },
  ];
}

// Someone pasted a Shopee link into the chat.
async function pastedLink(t, m) {
  const u = (t.match(/https?:\/\/\S+/) || [])[0];
  if (!u || !/(shopee\.co\.th|shp\.ee|shope\.ee)/i.test(u)) return null;
  // short link (ของตัวเองหรือคนอื่น) / an_redir: follow it to the product, then make it the member's own link
  if (isShortLink(u)) {
    const real = await resolveShortLink(u);
    if (!real) return text("เปิดลิงก์สั้นนี้ไม่เจอหน้าสินค้าค่ะ ลองส่งลิงก์หน้าสินค้าเต็ม (shopee.co.th/...) มาแทน", HELP_QR());
    return askAffId(m, real);
  }
  return askAffId(m, u);
}

function howto() {
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

// Not a member yet, or waiting for a seat.
async function gate(m, isFollow) {
  if (m?.status === "waitlist") {
    const r = await roster();
    const pos = r.waitlist.indexOf(m.id) + 1;
    return { type: "flex", altText: "อยู่ในคิว Early Access", contents: card("คุณอยู่ในคิว Early Access", `ลำดับที่ ${pos || "-"} · เมื่อมีที่ว่าง ปั๊กปักจะเปิดสิทธิ์ให้ หรือสมัคร Pro เพื่อใช้ได้ทันทีไม่ต้องรอคิว`, [{ type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "สมัคร Pro ใช้ได้ทันที", text: "อัปเกรด Pro" } }, openApp("ดูสถานะ")]) };
  }
  if (m?.status === "revoked") return text("บัญชีนี้ถูกระงับการใช้งาน หากคิดว่าผิดพลาด พิมพ์ \"ติดต่อแอดมิน\" ได้เลยค่ะ");
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

// Words people type for a category we already have under another name.
const SYNONYMS = { "ของกิน": "ขนม", "อาหาร": "ขนม", "ขนมขบเคี้ยว": "ขนม", "นาฬิกา": "สมาร์ทวอทช์", "smartwatch": "สมาร์ทวอทช์", "เครื่องมือ": "เครื่องมือช่าง", "อุปกรณ์ช่าง": "เครื่องมือช่าง", "ไฟฟ้า": "เครื่องใช้ไฟฟ้า", "เสื้อผ้า": "เสื้อผ้าผู้หญิง", "แฟชั่น": "เสื้อผ้าผู้หญิง" };
// "ท็อป หมวด พัดลม", "ท็อป — 5 ตะกร้า…" (help text pasted back) → the real keyword, or "" for the default top.
const cleanWant = (w) => {
  const x = (w || "").replace(/^[\s—–\-:•]+/, "").replace(/^หมวด\s*/, "").trim();
  return /^\d+\s*ตะกร้า/.test(x) ? "" : x;
};

function pickCat(all, want, cats, uid) {
  want = cleanWant(want);
  if (want) {
    const syn = SYNONYMS[want.toLowerCase()];
    if (syn && cats.includes(syn)) return syn;
    return cats.find((c) => c === want) || cats.find((c) => c.includes(want) || want.includes(c))
      // a scanned keyword inside a category, e.g. "พัดลมพกพา" → แก็ดเจ็ต
      || all.find((p) => p.keyword && (p.keyword === want || p.keyword.includes(want) || want.includes(p.keyword)))?.category;
  }
  // default: a different category per member, changing every day (Bangkok time), so not everyone films the same basket
  const list = [...cats].sort();
  if (!list.length) return undefined;
  const day = Math.floor((Date.now() + 7 * 36e5) / 864e5);
  return list[(bucket(uid) + day) % list.length];
}

async function top(all, want, cats, ctx = {}) {
  const c = pickCat(all, want, cats, ctx.m?.id);
  if (!c) return notInCatalog(want, cats, ctx);
  const list = byRank(rank(all.filter((p) => p.category === c))).slice(0, 5);
  addViews(list.length).catch(() => {});
  const newest = Math.max(...all.filter((p) => p.category === c).map((p) => p.fetchedAt || 0));
  const others = cats.filter((x) => x !== c).slice(0, 12).map((x) => qr(x, "ท็อป " + x));
  const locked = ctx.state?.locked?.[c];
  const head = locked?.length
    ? `🔒 ท็อป 1–${locked.length} หมวด "${c}" ปลดล็อคได้เฉพาะผู้ใช้งาน Pro\nด้านล่างคืออันดับ ${list[0]?._rank || 6}–${list[list.length - 1]?._rank || 10} · ข้อมูล ${ago(newest)}`
    : `ท็อป 5 หมวด "${c}" · ข้อมูล ${ago(newest)}`;
  const bubbles = [...(locked?.length ? [lockBubble(locked)] : []), ...list.map((p, i) => bubble(p, p._rank || i + 1))];
  return [
    text(`${head}${list.some((p) => p.affLink) ? "" : "\nอยากได้ลิงก์แอฟของคุณ: กด \"เอาลิงก์ของฉัน\" แล้วส่ง Affiliate ID มา"}`),
    { type: "flex", altText: locked?.length ? `ท็อป ${c} (ท็อป 5 ล็อกไว้สำหรับ Pro)` : `ท็อป 5 ${c}`, contents: { type: "carousel", contents: bubbles }, ...(others.length ? { quickReply: { items: others } } : {}) },
  ];
}

// "มาแรงวันนี้": across all categories, products selling faster than their own 30-day average.
// Free: top 3 (never the locked top-5 of the lock test). Pro: top 10. Owner links only for the member's own scans.
async function hot(state, pro, mixFrom) {
  const { items } = await trending(await ownerProducts(), 20);
  const pool = state.lockedIds ? items.filter((p) => !state.lockedIds.has(p.id)) : items;
  const n = pro ? 10 : 3;
  const list = pool.slice(0, n).map((p) => ({
    ...publicProduct(p), _t: p._t, _a: p._a, _perOrder: p._perOrder, _perDay: p._perDay, _boost: p._boost,
    ...(!state.shared && state.products?.[p.id]?.affLink ? { affLink: state.products[p.id].affLink } : {}),
  }));
  if (!list.length && mixFrom) return mix(mixFrom.all, mixFrom.cats);
  if (!list.length) return text("🔥 มาแรงวันนี้ยังไม่พร้อมค่ะ ต้องมีข้อมูลยอดขายอย่างน้อย 2 วันเพื่อเทียบกัน\nระหว่างนี้ดูท็อปรายหมวดไปก่อนได้เลย", HELP_QR());
  addViews(list.length).catch(() => {});
  const more = pool.length - list.length;
  return [
    text(`🔥 มาแรงวันนี้ · ${list.length} ตะกร้าที่ยอดขายกำลังพุ่ง จากทุกหมวด\nเทียบกับยอดขายปกติของตัวมันเอง ไม่ใช่ยอดรวม${!pro && more > 0 ? `\n\nแพ็ก Pro ดูได้อีก ${more} ตัว` : ""}`),
    { type: "flex", altText: "🔥 มาแรงวันนี้", contents: { type: "carousel", contents: list.map((p, i) => bubble(p, i + 1)) }, quickReply: { items: HELP_QR().slice(1) } },
  ];
}

// "ท็อปรวมวันนี้": the #1 of every category in one carousel (until มาแรง has two days of data).
function mix(all, cats) {
  const list = cats.map((c) => byRank(rank(all.filter((p) => p.category === c)))[0]).filter(Boolean).sort((a, b) => b._t - a._t).slice(0, 10);
  addViews(list.length).catch(() => {});
  const others = cats.slice(0, 12).map((x) => qr(x, "ท็อป " + x));
  return [
    text(`ท็อปรวมวันนี้ · อันดับ 1 ของแต่ละหมวด ${list.length} หมวด\nอยากดูลึกหมวดไหน กดชื่อหมวดด้านล่าง${list.some((p) => p.affLink) ? "" : "\nอยากได้ลิงก์แอฟของคุณ: กด \"เอาลิงก์ของฉัน\" แล้วส่ง Affiliate ID มา"}`),
    { type: "flex", altText: "ท็อปรวมวันนี้", contents: { type: "carousel", contents: list.map((p, i) => bubble({ ...p, _cat: p.category }, i + 1)) }, ...(others.length ? { quickReply: { items: others } } : {}) },
  ];
}

// Asked for a category the catalog doesn't have (e.g. "ท็อป สายนาฬิกา"):
// log the demand for the admin, show any matching products we do have, and point to Pro's own search.
async function notInCatalog(want, cats, { m, pro, state } = {}) {
  want = cleanWant(want);
  const kw = want.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
  logRequest(kw, m?.id).catch(() => {});
  const pool = state?.shared ? (await ownerProducts()).filter((p) => !state.lockedIds?.has(p.id)).map(publicProduct) : Object.values(state?.products || {});
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

// Stored rank (6–10 while top 5 is locked) wins over the order re-ranked from a partial list.
const byRank = (list) => (list.some((p) => p._rank) ? [...list].sort((a, b) => (a._rank || 99) - (b._rank || 99)) : list);

// First card of the carousel while the lock test is on: ranks 1–5 hidden, only ≈฿/order as a teaser.
function lockBubble(rows) {
  return {
    type: "bubble", size: "kilo",
    styles: { body: { backgroundColor: "#2B1E16" }, footer: { backgroundColor: "#2B1E16" } },
    body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents: [
      { type: "text", text: "🔒", size: "3xl", align: "center" },
      { type: "text", text: `ปลดล็อคตะกร้า Top ${rows.length}`, weight: "bold", size: "lg", color: "#FFFFFF", align: "center", wrap: true },
      { type: "text", text: "สำหรับผู้ใช้งาน Pro เท่านั้น", size: "sm", color: "#FFC9A6", align: "center", wrap: true },
      { type: "separator", margin: "lg", color: "#4A382C" },
      ...rows.map((r) => ({ type: "box", layout: "horizontal", margin: "md", contents: [
        { type: "text", text: `#${r.rank}`, weight: "bold", size: "sm", color: "#FE6A0E", flex: 0 },
        { type: "text", text: "▒▒▒▒▒▒▒▒", size: "sm", color: "#5C4636", flex: 3, margin: "md" },
        { type: "text", text: r.perOrder ? `~${baht(r.perOrder)}/ออเดอร์` : "", size: "xxs", color: "#FFC9A6", align: "end", gravity: "center", flex: 3 },
      ] })),
    ] },
    footer: { type: "box", layout: "vertical", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "ปลดล็อคด้วย Pro", text: "อัปเกรด Pro" } },
    ] },
  };
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

const thDate = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

// Plan picker. Shown from the rich menu ("อัปเกรด Pro"), typed keywords, or Free-only features.
function buyCard(m, why, lock = false) {
  const isProNow = isPro(m);
  const head = why || (isProNow ? "ต่ออายุ Pro" : "อัปเกรดเป็น Pro");
  const sub = isProNow
    ? (m.proUntil ? `Pro ของคุณใช้ได้ถึง ${thDate(m.proUntil)} ต่ออายุแล้ววันจะบวกต่อจากเดิม` : "บัญชีนี้เป็น Pro ไม่หมดอายุ")
    : (lock ? "• ปลดล็อคตะกร้า Top 5 ทุกหมวด\n• ดูได้ทุกตัว ไม่ใช่แค่ 5 ตัว" : "• ดูได้ทุกตัว ไม่ใช่แค่ท็อป 5") + "\n• AI ไอเดียคลิปวันละ 30 ตัว (Free 3)\n• ขั้นสูง: ลิงก์อัตโนมัติ + สแกนหมวดของคุณเอง";
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
    text(`แพ็ก Pro ${plan === "year" ? "รายปี" : "รายเดือน"} ยอด ฿${amount}\n\n1) สแกน QR พร้อมเพย์ด้านล่าง ร้าน ปั๊กปัก รับได้ทุกธนาคาร\n2) โอน ฿${amount} แล้วส่งรูปสลิปในแชทนี้ภายใน ${ORDER_TTL_H} ชม. (เกินเวลาคำสั่งซื้อจะถูกยกเลิก เลือกแพ็กใหม่ได้ตลอด)\n\nแอดมินตรวจแล้วเปิดสิทธิ์ให้ ระบบจะแจ้งในแชทนี้ทันที`),
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
  if (!ls.length) return text("ยังไม่มีลิงก์ที่สร้างไว้ สแกนหมวดบนคอมแล้วระบบจะสร้างลิงก์ Top 20 ให้อัตโนมัติค่ะ", HELP_QR());
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
  if (!p) return reply(e.replyToken, text("ไม่พบสินค้านี้แล้ว ลองพิมพ์ \"ท็อป\" ใหม่ค่ะ"));
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
