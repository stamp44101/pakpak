// LINE bot webhook: members use ปั๊กปัก from the chat (top products, links, AI ideas).
// The LINE userId equals the member id because Login and Messaging API share the ปั๊กปัก provider.
import { verifySignature, reply, push, loading, botFetch } from "../../../../lib/line";
import { getMember, ensureMember, saveMember, roster, seatsLeft, isAdmin } from "../../../../lib/auth";
import { freeWelcome } from "../../../../lib/welcome";
import { notifyDiscord } from "../../../../lib/discord";
import { addViews } from "../../../../lib/activity";
import { readJSON, writeJSON } from "../../../../lib/store";
import { rank, effPrice } from "../../../../lib/score";
import { scoreItem } from "../../../../lib/ai";
import { isPro, orderOf, pickOrder, makeAdminPro } from "../../../../lib/plan";
import { ownerProducts, publicProduct } from "../../../../lib/catalog";
import { flags, setFlag, bucket } from "../../../../lib/flags";
import { viewOf, sharedCatalog, topAll, hotView, lockTop5For, lockLabel, paywallLabel, freeRulesNow, countdownLine, chooseCat, todayCat, useLink } from "../../../../lib/access";
import { parseAffId, cleanProductUrl, isShortLink, resolveShortLink, AFF_ID_HOW } from "../../../../lib/afflink";
import { ago } from "../../../../lib/fmt";
import { APP, text, qr, HELP_QR, openApp, card, bubble, lockBubble, buyCard, payInfo, howto, affResult } from "../../../../lib/bot/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
      const plan = pickOrder(m, new URLSearchParams(e.postback.data).get("p")), o = orderOf(plan);
      const lockGroup = lockTop5For(await flags(), m);
      m.pendingOrder = { plan, at: Date.now(), ...(lockGroup ? { lockGroup: true } : {}) };
      await saveMember(m);
      await Promise.all([
        reply(e.replyToken, payInfo(plan)),
        notifyDiscord("interest", { title: `🛒 เลือกแพ็ก Pro ${o.label} ฿${o.price.toLocaleString("en-US")}`, lines: [`**${m.name}** กำลังจะโอน${lockGroup ? " · กลุ่มทดสอบล็อกท็อป 5" : ""}`, `${APP}/admin`] }).catch(() => {}),
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
      const o = orderOf(m.pendingOrder.plan);
      const slip = await botFetch(`message/${e.message.id}/content`, { data: true, method: "GET" }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      await Promise.all([
        reply(e.replyToken, text(`ได้รับสลิปแล้ว ขอบคุณค่ะ 🙏
แอดมินกำลังตรวจสอบ เปิดสิทธิ์ Pro ${o.span} แล้วจะแจ้งในแชทนี้ทันที`)),
        notifyAdmins(m).catch(() => {}),
        notifyDiscord("slip", { title: `💰 สลิปใหม่ ฿${o.price.toLocaleString("en-US")} · Pro ${o.label}`, lines: [`**${m.name}** ส่งสลิปแล้ว ตรวจยอดแล้วกดอนุมัติ`, `${APP}/admin`], image: slip }).catch(() => {}),
      ]);
      return;
    }
    if (e.type === "message" && e.message.type === "text" && /^(อัปเกรด|อัพเกรด|ซื้อ|สมัคร pro|ต่ออายุ|pro$|แพ็ก|ราคา)/i.test(e.message.text.trim())) return reply(e.replyToken, buyCard(m));
  }

  if (!m || m.status !== "active") return reply(e.replyToken, await gate(m, e.type === "follow"));
  // First contact after moving from the waitlist to Free: say so once, with the limits.
  if (m.welcomeFree && !isPro(m)) {
    m.welcomeFree = false; await saveMember(m);
    return reply(e.replyToken, freeWelcome(m, await freeRulesNow()));
  }
  if (e.type === "follow") return reply(e.replyToken, text(`ยินดีต้อนรับ คุณ${m.name} 🐶\nกด "ท็อป 5 วันนี้" ที่เมนูด้านล่าง ได้ตะกร้าน่าทำคลิปทันที ใช้บนมือถือได้เลยไม่ต้องเปิดคอม`, HELP_QR()));

  // admin can preview the Free experience: "ดูแบบ free" / "ดูแบบ pro"
  const admin = await isAdmin(uid);
  if (admin && (m.plan !== "pro" || m.proUntil || m.pendingOrder)) { makeAdminPro(m); await saveMember(m); }
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
  // Paywall V2 switch: "paywall" (status) · "paywall on" · "paywall off" · "paywall admin" · "paywall auto" (on from D0)
  const pw = admin && tt.match(/^(?:paywall|เพย์วอลล์)\s*(on|off|admin|auto|เปิด|ปิด)?$/);
  if (pw) {
    if (pw[1]) await setFlag("paywallV2", { เปิด: "on", ปิด: "off" }[pw[1]] || pw[1], uid);
    const f = await flags();
    return reply(e.replyToken, text(`💰 Paywall V2: ${paywallLabel(f.paywallV2)}${f.paywallV2At ? `\nเปลี่ยนล่าสุด ${ago(f.paywallV2At)}` : ""}\n\nFree V2 = วันละ 1 หมวด เห็น #6–8 · AI 1/วัน · ลิงก์ Aff ID 3/วัน\nสั่งได้: "paywall admin" (ทดสอบเอง + "ดูแบบ free") · "paywall on" · "paywall off" (ย้อนกลับทันที) · "paywall auto" (เปิดเองคืนนี้เที่ยงคืน)\nมีผลกับทุกคนภายใน ~30 วิ`, HELP_QR()));
  }
  // What this member may see (lib/access.js). Pro with own scans uses them; everyone else the shared catalog.
  const view = await viewOf(m, { admin });
  const { pro } = view;
  let state = (await readJSON(`users/m_${uid}.json`)) || { products: {} };
  if (!pro || !Object.keys(state.products || {}).length) {
    const sc = await sharedCatalog(view);
    state = { ...state, products: sc.products, locked: sc.locked, lockedIds: sc.lockedIds, shared: true };
  }
  const all = Object.values(state.products || {});
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];

  if (e.type === "postback") {
    const q = new URLSearchParams(e.postback.data);
    if (q.get("a") === "ai") return aiIdea(e, m, state, q.get("id"));
    if (q.get("a") === "top") return reply(e.replyToken, await top(all, q.get("c"), cats, { m, view, state }));
    if (q.get("a") === "link") { const p = await shownProduct(state, q.get("id")); return reply(e.replyToken, await askAffId(m, p?.url, p?.name)); }
    return;
  }
  if (e.type !== "message" || e.message.type !== "text") return;
  const t = e.message.text.trim();

  // Waiting for this member's Affiliate ID (after "เอาลิงก์ของฉัน" or a pasted product link)
  if (m.awaitAff && Date.now() - m.awaitAff.at < 30 * 60e3 && !COMMAND.test(t) && !/https?:\/\//.test(t)) {
    const id = parseAffId(t);
    if (!id) return reply(e.replyToken, text(`ถ้าอยากได้ลิงก์แอฟของตัวเอง ต้องทราบ Affiliate ID ของตัวเองก่อนค่ะ\n\n${AFF_ID_HOW}\n\nพิมพ์เฉพาะตัวเลขส่งมาได้เลย`, idQR(m)));
    const { url, name } = m.awaitAff;
    const quota = useLink(m, view);
    m.affId = id; m.awaitAff = null; await saveMember(m);
    if (!quota.ok) return reply(e.replyToken, [text(`แพ็ก Free ทำลิงก์ได้วันละ ${quota.limit} ลิงก์ ครบแล้ววันนี้ค่ะ พรุ่งนี้ทำต่อได้ หรืออัปเกรด Pro ทำได้ไม่จำกัด`), buyCard(m)]);
    return reply(e.replyToken, affResult(url, name, id, quota.left));
  }
  if (m.awaitAff) { m.awaitAff = null; await saveMember(m); }

  if (/^(วิธีเอาลิงก์|เอาลิงก์ยังไง)/.test(t)) return reply(e.replyToken, text(NEED_ID, HELP_QR()));
  if (/^(วิธีใช้|ช่วยเหลือ|help)/i.test(t)) return reply(e.replyToken, howto());
  if (state.shared && /^(ลิงก์|ลิ้ง|link)/i.test(t)) return reply(e.replyToken, text(NEED_ID, HELP_QR()));
  if (/^(ติดต่อแอดมิน|แอดมิน)/.test(t)) return reply(e.replyToken, text("รับเรื่องแล้วค่ะ พิมพ์รายละเอียดทิ้งไว้ได้เลย แอดมินจะตอบกลับในแชทนี้ 🙏"));
  if (!all.length) return reply(e.replyToken, { type: "flex", altText: "ยังไม่มีข้อมูลตะกร้า", contents: card("ยังไม่มีข้อมูลตะกร้า", "คลังกลางกำลังอัปเดต ลองใหม่อีกสักครู่ หรือพิมพ์ \"ติดต่อแอดมิน\"", [openApp("เปิดปั๊กปัก")]) });

  const pasted = await pastedLink(t, m);
  if (pasted) return reply(e.replyToken, pasted);
  if (/^(🔥\s*)?มาแรง/.test(t)) return reply(e.replyToken, await hot(state, view));
  const cm = t.match(/^(?:ท็อป|top|ท๊อป)\s*\d*\s*(.*)$/i);
  // plain "ท็อป" (rich menu): one cross-category list — มาแรง when there is data, else each category's #1
  if (cm && !cleanWant(cm[1].trim())) return reply(e.replyToken, await hot(state, view, true));
  if (cm) return reply(e.replyToken, await top(all, cm[1].trim(), cats, { m, view, state }));
  if (cats.includes(t)) return reply(e.replyToken, await top(all, t, cats, { m, view, state }));
  const sm = t.match(/^(?:หา|ค้นหา|ค้น|search)\s+(.+)$/i);
  if (sm) return reply(e.replyToken, await top(all, sm[1].trim(), cats, { m, view, state }));
  if (/^หมวด/.test(t)) return reply(e.replyToken, text("เลือกหมวดที่อยากดูท็อป 5", cats.slice(0, 13).map((c) => qr(c, "ท็อป " + c))));
  if (/^(ลิงก์|ลิ้ง|link)/i.test(t)) return reply(e.replyToken, links(all));
  if (/^สถานะ/.test(t)) return reply(e.replyToken, status(all, cats, state, m, view));
  if (t.length >= 12) {
    const head = t.toLowerCase().slice(0, 18);
    const hit = all.find((p) => (p.name || "").toLowerCase().startsWith(head) || (p.name || "").toLowerCase().includes(head));
    if (hit?.url && !hit.affLink) return reply(e.replyToken, await askAffId(m, hit.url, hit.name));
  }
  return reply(e.replyToken, text(`พิมพ์ได้แบบนี้ค่ะ\n• มาแรง — ตะกร้าที่ยอดขายกำลังพุ่ง ทุกหมวด\n• ท็อป — ท็อปรวมวันนี้ จากทุกหมวด\n• ท็อป ห้องครัว — เฉพาะหมวด\n• หมวด — เลือกหมวด\n• หา สายนาฬิกา — ค้นสินค้าที่อยากทำ\n• ลิงก์ — ลิงก์ affiliate ที่สร้างแล้ว\n• สถานะ — ข้อมูลอัปเดตล่าสุดเมื่อไร`, HELP_QR()));
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
  const fr = await freeRulesNow();
  const body = left > 0 ? `Early Access เหลือ ${left} ที่ สมัครด้วย LINE แล้วใช้งานได้ทันที` : `สมัครด้วย LINE แล้วใช้ฟรีได้ทันที (${fr.oneCat ? `วันละ 1 หมวด ${fr.show} ตะกร้า` : `ท็อป ${fr.show}/หมวด`} · AI ${fr.aiPerDay} ครั้ง/วัน)`;
  return { type: "flex", altText: "สมัครใช้ปั๊กปัก", contents: card(isFollow ? "ยินดีต้อนรับสู่ปั๊กปัก 🐶" : "ใช้งานได้หลังสมัครสมาชิก", `ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น\n${body}`, [openApp(left > 0 ? "สมัคร Early Access" : "สมัครใช้ฟรี")]) };
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
  const { m, view } = ctx;
  const c = (!cleanWant(want) && view?.rules.oneCat && todayCat(m) && cats.includes(todayCat(m))) ? todayCat(m) : pickCat(all, want, cats, m?.id);
  if (!c) return notInCatalog(want, cats, ctx);
  // Free V2: one category a day — the first one opened today
  const day = await chooseCat(m, c, view);
  if (!day.ok) return [
    text(`วันนี้คุณเลือกหมวด "${day.cat}" แล้วค่ะ แพ็ก Free ดูได้วันละ 1 หมวด พรุ่งนี้เลือกหมวดใหม่ได้\nอยากดู "${c}" ตอนนี้เลย อัปเกรด Pro ดูได้ทุกหมวด`, [qr(`ดู ${day.cat}`, `ท็อป ${day.cat}`), qr("🔥 มาแรง", "มาแรง")]),
    buyCard(m),
  ];
  const list = byRank(rank(all.filter((p) => p.category === c))).slice(0, 5);
  addViews(list.length).catch(() => {});
  const newest = Math.max(...all.filter((p) => p.category === c).map((p) => p.fetchedAt || 0));
  const others = view?.rules.oneCat ? HELP_QR().slice(0, 1) : cats.filter((x) => x !== c).slice(0, 12).map((x) => qr(x, "ท็อป " + x));
  const locked = ctx.state?.locked?.[c];
  const cd = await countdownLine(view);
  const head = locked?.length
    ? `🔒 ท็อป 1–${locked.length} หมวด "${c}" ปลดล็อคได้เฉพาะผู้ใช้งาน Pro\nด้านล่างคืออันดับ ${list[0]?._rank || 6}–${list[list.length - 1]?._rank || 10} · ข้อมูล ${ago(newest)}`
    : `ท็อป 5 หมวด "${c}" · ข้อมูล ${ago(newest)}`;
  const note = (day.first ? `\n📌 หมวดของวันนี้ (แพ็ก Free ดูได้วันละ 1 หมวด)` : "") + (cd ? `\n\n${cd}` : "");
  const bubbles = [...(locked?.length ? [lockBubble(locked)] : []), ...list.map((p, i) => bubble(p, p._rank || i + 1))];
  return [
    text(`${head}${note}${list.some((p) => p.affLink) ? "" : "\nอยากได้ลิงก์แอฟของคุณ: กด \"เอาลิงก์ของฉัน\" แล้วส่ง Affiliate ID มา"}`),
    { type: "flex", altText: locked?.length ? `ท็อป ${c} (ท็อป 5 ล็อกไว้สำหรับ Pro)` : `ท็อป 5 ${c}`, contents: { type: "carousel", contents: bubbles }, ...(others.length ? { quickReply: { items: others } } : {}) },
  ];
}

const tail = async (view) => { const cd = await countdownLine(view); return cd ? `\n\n${cd}` : ""; };

// A product the member was shown (cards in มาแรง / ท็อปรวม can come from outside their category list).
async function shownProduct(state, id) {
  if (state.products?.[id]) return state.products[id];
  if (!state.shared) return null;
  const p = (await ownerProducts()).find((x) => x.id === id);
  return p ? publicProduct(p) : null;
}

// Carousel with the locked teaser card first (Free) — used by มาแรง and ท็อปรวม.
const lockedCarousel = (alt, locked, items, quick) => ({ type: "flex", altText: locked.length ? `${alt} (ท็อป ${locked.length} ล็อกไว้สำหรับ Pro)` : alt,
  contents: { type: "carousel", contents: [...(locked.length ? [lockBubble(locked)] : []), ...items.map((p) => bubble(p, p._n))] }, ...(quick?.length ? { quickReply: { items: quick } } : {}) });
const lockHead = (locked, items) => `🔒 อันดับ 1–${locked.length} ปลดล็อคได้เฉพาะผู้ใช้งาน Pro${items.length ? `\nด้านล่างคืออันดับ ${locked.length + 1}–${locked.length + items.length}` : ""}`;

// "มาแรงวันนี้" (rules: lib/access.js hotView). Owner links only for the member's own scans.
// fallbackTop: plain "ท็อป" shows ท็อปรวมวันนี้ instead while มาแรง has no data yet.
async function hot(state, view, fallbackTop) {
  const { pro } = view;
  const { locked, items: raw, more } = await hotView(view);
  if (!raw.length && !locked.length) {
    if (fallbackTop) return topToday(state, view);
    return text("🔥 มาแรงวันนี้ยังไม่พร้อมค่ะ ต้องมีข้อมูลยอดขายอย่างน้อย 2 วันเพื่อเทียบกัน\nระหว่างนี้ดูท็อปรายหมวดไปก่อนได้เลย", HELP_QR());
  }
  const items = raw.map((p) => ({ ...p, ...(!state.shared && state.products?.[p.id]?.affLink ? { affLink: state.products[p.id].affLink } : {}) }));
  addViews(items.length).catch(() => {});
  const head = locked.length ? `🔥 มาแรงวันนี้ · ${lockHead(locked, items)}` : `🔥 มาแรงวันนี้ · ${items.length} ตะกร้าที่ยอดขายกำลังพุ่ง จากทุกหมวด`;
  return [
    text(`${head}\nเทียบกับยอดขายปกติของตัวมันเอง ไม่ใช่ยอดรวม${!pro && more > 0 ? `\n\nแพ็ก Pro ดูได้อีก ${more} ตัว` : ""}${await tail(view)}`),
    lockedCarousel("🔥 มาแรงวันนี้", locked, items, HELP_QR().slice(1)),
  ];
}

// "ท็อปรวมวันนี้": the #1 of every category (rules: lib/access.js topAll).
async function topToday(state, view) {
  const { locked, items, cats } = await topAll({ ...view, own: state.shared ? null : Object.values(state.products || {}) });
  addViews(items.length).catch(() => {});
  const head = locked.length ? `ท็อปรวมวันนี้ · ${lockHead(locked, items)} จากอันดับ 1 ของแต่ละหมวด` : `ท็อปรวมวันนี้ · อันดับ 1 ของแต่ละหมวด ${items.length} หมวด`;
  return [
    text(`${head}\n${view.rules.oneCat ? "แพ็ก Free เลือกดูลึกได้วันละ 1 หมวด" : "อยากดูลึกหมวดไหน กดชื่อหมวดด้านล่าง"}${await tail(view)}${items.some((p) => p.affLink) ? "" : "\nอยากได้ลิงก์แอฟของคุณ: กด \"เอาลิงก์ของฉัน\" แล้วส่ง Affiliate ID มา"}`),
    lockedCarousel("ท็อปรวมวันนี้", locked, items.map((p) => ({ ...p, _cat: p.category })), cats.slice(0, 12).map((x) => qr(x, "ท็อป " + x))),
  ];
}

// Asked for a category the catalog doesn't have (e.g. "ท็อป สายนาฬิกา"):
// log the demand for the admin, show any matching products we do have, and point to Pro's own search.
async function notInCatalog(want, cats, { m, view, state } = {}) {
  const pro = !!view?.pro;
  want = cleanWant(want);
  const kw = want.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
  logRequest(kw, m?.id).catch(() => {});
  // Free V2: searching across categories is a Pro thing
  const pool = view?.rules.oneCat ? [] : state?.shared ? (await ownerProducts()).filter((p) => !state.lockedIds?.has(p.id)).map(publicProduct) : Object.values(state?.products || {});
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
    out.splice(out.length - 1, 0, text(`${hits.length ? "" : `ตอนนี้คลังกลางยังไม่มี "${want}" `}แพ็ก Free ดูได้เฉพาะหมวดที่มีอยู่${view?.rules.oneCat ? " วันละ 1 หมวด" : ""} ส่วน Pro ค้นสินค้าเฉพาะตัวที่คุณทำเองได้ จัดอันดับ + สร้างลิงก์ให้ทุกตัว\nแจ้งทีมไว้แล้วว่ามีคนอยากได้หมวดนี้ 🙏`));
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

// Stored rank (6–10 while a category's top 5 is locked) wins over the order re-ranked from a partial list.
const byRank = (list) => (list.some((p) => p._rank) ? [...list].sort((a, b) => (a._rank || 99) - (b._rank || 99)) : list);

async function notifyAdmins(m) {
  const r = await roster();
  const msg = text(`💰 มีสลิปใหม่\n${m.name} · Pro ${orderOf(m.pendingOrder.plan).label} ฿${orderOf(m.pendingOrder.plan).price.toLocaleString("en-US")}\nตรวจสลิปในแชท OA แล้วกดอนุมัติที่ ${APP}/admin`);
  await Promise.all(r.admins.map((id) => push(id, msg)));
}

function links(all) {
  const ls = all.filter((p) => p.affLink).sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0)).slice(0, 15);
  if (!ls.length) return text("ยังไม่มีลิงก์ที่สร้างไว้ สแกนหมวดบนคอมแล้วระบบจะสร้างลิงก์ Top 20 ให้อัตโนมัติค่ะ", HELP_QR());
  return text(`ลิงก์ล่าสุด ${ls.length} อัน\n\n` + ls.map((p, i) => `${i + 1}. ${(p.name || "").slice(0, 40)}\n${p.affLink}`).join("\n\n"), HELP_QR());
}

function status(all, cats, state, m, view) {
  const { pro } = view;
  const plan = pro ? `แพ็ก Pro${m.earlyAccess ? " (Early Access)" : ""}${m.proUntil ? ` ถึง ${new Date(m.proUntil).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}` : (view.rules.oneCat ? `แพ็ก Free · วันละ 1 หมวด${todayCat(m) ? ` (วันนี้: ${todayCat(m)})` : ""} · AI ${view.rules.aiPerDay}/วัน · ลิงก์ ${view.rules.linksPerDay}/วัน` : `แพ็ก Free · คลังกลาง ${view.rules.show} ตัว/หมวด · AI ${view.rules.aiPerDay}/วัน`);
  if (state.shared) return text(`${plan}\nหมวดในคลังกลาง: ${cats.join(", ")}\n\n${pro ? "อยากได้ลิงก์อัตโนมัติหรือสแกนหมวดเอง กด \"วิธีใช้\" → ขั้นสูง (คอม)" : "พิมพ์ \"อัปเกรด\" เพื่อดูสิทธิ์ Pro"}`, HELP_QR());
  const newest = Math.max(0, ...all.map((p) => p.fetchedAt || 0));
  const lines = cats.map((c) => { const ps = all.filter((p) => p.category === c); return `• ${c}: ${ps.length} ตัว · ลิงก์ ${ps.filter((p) => p.affLink).length} · ${ago(Math.max(...ps.map((p) => p.fetchedAt || 0)))}`; });
  return text(`${plan}\nบัญชี Shopee: ${state.account || "-"}\nอัปเดตล่าสุด ${newest ? ago(newest) : "-"}\n\n${lines.join("\n")}\n\nข้อมูลเกิน 3 วัน แนะนำเปิดคอมที่มี Connector แล้วกด "อัปเดตตอนนี้"`, HELP_QR());
}

async function aiIdea(e, m, state, id) {
  const p = await shownProduct(state, id);
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
