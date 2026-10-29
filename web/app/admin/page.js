"use client";
import { orderOf } from "../../lib/plan";
import { useEffect, useRef, useState } from "react";

const STATUS = { active: "ใช้งานได้", waitlist: "รอคิว", revoked: "ระงับ" };
const STEPS = [["line", "เข้าสู่ระบบ"], ["bot", "เพิ่มเพื่อนบอท"], ["applink", "เอาลิงก์จากแอป"]];
const nextStep = (done) => (STEPS.find(([k]) => !done.includes(k)) || [null, "ครบแล้ว"])[1];
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
// Filters: who needs attention first (slip to check → chose a plan → hit the Free AI limit today).
const FILTERS = [
  ["all", "ทั้งหมด", () => true],
  ["slip", "ส่งสลิป", (m) => !!m.pendingOrder?.slipAt],
  ["interest", "สนใจ Pro", (m) => !!m.pendingOrder && !m.pendingOrder.slipAt],
  ["promo", "โปร ฿99", (m) => !!m.promo?.at],
  ["grants", "ได้สิทธิ์แคมเปญ", (m) => m.grants?.length > 0],
  ["heavy", "ใช้ AI ครบโควตาวันนี้", (m) => m.plan !== "pro" && m.aiDay === today() && m.aiToday >= (m.limits?.aiPerDay || 3)],
  ["paid", "จ่ายจริง", (m) => m.plan === "pro" && !m.admin && m.payments?.length > 0],
  ["pro", "Pro", (m) => m.plan === "pro" && !m.admin],
  ["free", "Free", (m) => m.plan !== "pro"],
  ["admin", "ผู้ดูแล", (m) => m.admin],
];
// Where a member is in the ฿99 offer funnel (card sent from here → buttons in LINE → slip → approved).
const promoStage = (m) => {
  const p = m.promo;
  if (!p?.at) return null;
  if (p.paidAt) return ["ซื้อแล้ว", "pro"];
  if (m.pendingOrder?.slipAt && m.pendingOrder.promo) return ["ส่งสลิปแล้ว", "slip"];
  if (p.interestedAt) return [m.promoLive ? "สนใจ รอโอน" : "สนใจ แต่หมดเวลา", "hot"];
  if (p.cancelledAt && !m.promoLive) return ["ยกเลิกข้อเสนอ", ""];
  if (!m.promoLive) return ["หมดเวลา ไม่ตอบ", ""];
  if (p.declinedAt) return ["ไว้ก่อน", ""];
  return ["ส่งแล้ว ยังไม่กด", ""];
};
const rankOf = (m) => (m.pendingOrder?.slipAt ? 0 : m.pendingOrder ? 1 : 2);

// One picker for every campaign (lib/campaigns.js), so a new campaign never adds a button here.
function GrantPicker({ m, campaigns = [], cap, onGrant }) {
  const [key, setKey] = useState("");
  const own = (k) => (m.grants || []).filter((g) => g.campaign === k).length;
  const c = campaigns.find((x) => x.key === key);
  const why = (x) => (x.perMember && own(x.key) >= x.perMember ? "ได้แล้ว" : x.who === "free" && m.plan === "pro" ? "เฉพาะ Free" : x.who === "pro" && m.plan !== "pro" ? "เฉพาะ Pro" : (m.freeDays || 0) + x.days > cap ? `เกินเพดาน ${cap} วัน` : "");
  if (!campaigns.length) return <a className="btn" href="/admin/campaigns">🎁 สร้างแคมเปญ</a>;
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      <select value={key} onChange={(e) => setKey(e.target.value)} style={{ padding: "5px 8px", fontSize: 13 }} aria-label="เลือกแคมเปญ">
        <option value="">🎁 ให้สิทธิ์จากแคมเปญ…</option>
        {campaigns.map((x) => <option key={x.key} value={x.key} disabled={!!why(x)}>{x.label} · +{x.days} วัน{why(x) ? ` (${why(x)})` : ""}</option>)}
      </select>
      {c && <button className="btn primary" onClick={() => confirm(`${c.proof ? `ตรวจแล้วว่า ${m.name} ${c.proof}?\n` : ""}${m.plan === "pro" ? `ต่อ Pro ให้ ${m.name} อีก ${c.days} วัน` : `เปิด Pro ให้ ${m.name} ${c.days} วัน`} (${c.label}) ระบบจะแจ้งใน LINE ให้เอง`) && onGrant(c.key)}>ให้สิทธิ์</button>}
      {m.grants?.length > 0 && <span className="hint" style={{ fontSize: 12 }}>ได้ฟรีไปแล้ว {m.freeDays} วัน</span>}
    </span>
  );
}

const PAGE = 50; // rows drawn at a time; the next batch loads when the list end scrolls into view

// Invisible marker at the end of the list: calls onShow when it scrolls near the viewport.
function MoreOnScroll({ onShow }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && onShow(), { rootMargin: "400px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [onShow]);
  return <div ref={ref} />;
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);
  const [menuMsg, setMenuMsg] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [annMsg, setAnnMsg] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [q, setQ] = useState("");

  const load = () => fetch("/api/admin").then((r) => r.json()).then((j) => (j.error ? setErr(j.error) : setData(j))).catch(() => setErr("โหลดไม่สำเร็จ"));
  useEffect(() => { load(); }, []);

  async function set(id, status, extra) {
    setOpenId(null);
    const r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(status ? { id, status } : { id, ...extra }) }).then((x) => x.json());
    if (r.error) setErr(r.error); else load();
  }

  const short = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const stats = data && {
    pro: data.members.filter((m) => m.status === "active" && m.plan === "pro").length,
    free: data.members.filter((m) => m.status === "active" && m.plan !== "pro").length,
    wait: data.members.filter((m) => m.status === "waitlist").length,
  };

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <header className="top">
        <div><h1>สมาชิก</h1></div>
        <div className="bar" style={{ gap: 6 }}><a className="btn" href="/admin/campaigns">🎁 แคมเปญ</a><a className="btn" href="/">← กลับไปปั๊กปัก</a></div>
      </header>
      {err && <p className="hint">{err}</p>}
      {data && <>
        <div className="stats">
          <span><b className="num">{stats.pro}</b> Pro</span>
          {(() => {
            const paying = data.members.filter((m) => m.plan === "pro" && !m.admin && m.payments?.length > 0);
            const total = data.members.filter((m) => !m.admin).reduce((t, m) => t + (m.payments || []).reduce((a, p) => a + (p.amount || 0), 0), 0);
            return <span title="Pro ที่อนุมัติสลิปแล้วและยังไม่หมดอายุ · ยอดรวมทุกสลิปที่อนุมัติ">จ่ายจริง <b className="num">{paying.length}</b> · ฿<b className="num">{total.toLocaleString("en-US")}</b></span>;
          })()}
          <span><b className="num">{stats.free}</b> Free</span>
          <span><b className="num">{stats.wait}</b> รอคิว</span>
          {data.members.some((m) => m.pendingOrder?.slipAt) && <span className="stat-alert"><b className="num">{data.members.filter((m) => m.pendingOrder?.slipAt).length}</b> สลิปรอตรวจ</span>}
          <span>Early Access เหลือ <b className="num">{Math.max(0, data.seats - data.active)}</b>/{data.seats}</span>
          {data.quota
            ? <span className={data.quota.left != null && data.quota.left < 50 ? "stat-alert" : ""} title="โควตา push ของ LINE OA เดือนนี้ (reply ไม่นับ)">push เหลือ <b className="num">{data.quota.left == null ? "∞" : data.quota.left.toLocaleString("en-US")}</b>{data.quota.value != null && <>/{data.quota.value.toLocaleString("en-US")}</>}</span>
            : <span className="hint">push: อ่านโควตาไม่ได้</span>}
        </div>
        <div className="bar" style={{ flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
          {FILTERS.map(([k, label, fn]) => {
            const n = data.members.filter(fn).length;
            if (k !== "all" && !n && filter !== k) return null;
            return <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => { setFilter(k); setLimit(PAGE); }}>{label} <span className="num">{n}</span></button>;
          })}
          <input className="grow" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="ค้นหาชื่อ" style={{ minWidth: 140 }} />
        </div>
        <div className="list">
          {(() => {
            const fn = (FILTERS.find(([k]) => k === filter) || FILTERS[0])[2];
            const shown = data.members.filter(fn).filter((m) => !q.trim() || (m.name || "").toLowerCase().includes(q.trim().toLowerCase()))
              .sort((a, b) => rankOf(a) - rankOf(b) || (b.pendingOrder?.slipAt || b.pendingOrder?.at || b.joinedAt || 0) - (a.pendingOrder?.slipAt || a.pendingOrder?.at || a.joinedAt || 0));
            const canOffer = shown.filter((m) => m.status === "active" && !m.admin && !m.founding && !m.promoLive);
            const P = data.members.filter((m) => m.promo?.at), cnt = (fn) => P.filter(fn).length;
            return <>
          {filter === "promo" && P.length > 0 && (
            <div className="stats" style={{ margin: "0 0 10px" }}>
              <span>ส่ง <b className="num">{P.length}</b></span>
              <span>กดสนใจ <b className="num">{cnt((m) => m.promo.interestedAt)}</b></span>
              <span>ส่งสลิป <b className="num">{cnt((m) => m.promo.paidAt || (m.pendingOrder?.slipAt && m.pendingOrder.promo))}</b></span>
              <span>ซื้อแล้ว <b className="num">{cnt((m) => m.promo.paidAt)}</b></span>
              <span>ไว้ก่อน <b className="num">{cnt((m) => m.promo.declinedAt && !m.promo.interestedAt)}</b></span>
            </div>
          )}
          {filter === "interest" && (canOffer.length > 0 || offerMsg) && (
            <div className="bar" style={{ margin: "0 0 10px" }}>
              {canOffer.length > 0 && <button className="btn primary" disabled={offerMsg === "กำลังส่ง…"} onClick={async () => {
                if (!confirm(`ส่งการ์ดข้อเสนอ ฿99 ให้ ${canOffer.length} คนในกลุ่มนี้? (ใช้โควตา push ${canOffer.length} ข้อความ · ข้อเสนออยู่ 48 ชม.)`)) return;
                setOfferMsg("กำลังส่ง…");
                const r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: canOffer.map((m) => m.id) }) }).then((x) => x.json()).catch(() => ({ error: "เชื่อมต่อไม่ได้" }));
                setOfferMsg(r.ok ? `ส่งแล้ว ${r.sent} คน${r.skipped ? ` · ข้าม ${r.skipped}` : ""} → ดูผลที่ตัวกรอง "โปร ฿99"` : "ไม่สำเร็จ: " + (r.error || ""));
                load();
              }}>🎁 ส่งข้อเสนอ ฿99 ให้กลุ่มนี้ ({canOffer.length} คน)</button>}
              {offerMsg && <span className="hint">{offerMsg}</span>}
            </div>
          )}
          {!shown.length && <div className="empty"><strong>{data.members.length ? "ไม่พบสมาชิกในตัวกรองนี้" : "ยังไม่มีสมาชิก"}</strong></div>}
          {shown.slice(0, limit).map((m) => (
            <div key={m.id} className="mrow">
              {m.picture ? <img className="avatar" src={m.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar" />}
              <div className="mrow-main">
                <div className="mrow-name">{m.name}{m.pendingOrder && <span className={"tag order" + (m.pendingOrder.slipAt ? " slip" : "")}>{m.pendingOrder.slipAt ? "ส่งสลิปแล้ว" : "เลือกแพ็กแล้ว รอสลิป"} · {orderOf(m.pendingOrder.plan).label} ฿{orderOf(m.pendingOrder.plan).price.toLocaleString("en-US")}</span>}{promoStage(m) && <span className={"tag order" + (promoStage(m)[1] === "slip" || promoStage(m)[1] === "pro" ? " slip" : "")}>฿99 · {promoStage(m)[0]}</span>}{m.payments?.length > 0 && <span className="tag order slip" title={m.payments.map((p) => `${new Date(p.at).toLocaleDateString("th-TH")} ${orderOf(p.plan).label} ฿${p.amount}`).join("\n")}>จ่ายแล้ว ฿{m.payments.reduce((a, p) => a + (p.amount || 0), 0).toLocaleString("en-US")}{m.payments.length > 1 ? ` · ${m.payments.length} ครั้ง` : ""}</span>}{m.admin && <span className="tag">{m.owner ? "เจ้าของ" : "ผู้ดูแล"}</span>}{m.status !== "active" && <span className={"tag" + (m.status === "waitlist" ? " b" : "")}>{STATUS[m.status]}</span>}</div>
                <div className="mrow-sub">
                  สมัคร {short(m.joinedAt)} · เริ่มต้น {STEPS.filter(([k]) => k === "line" || m.onboarding.includes(k)).length}/3{m.status === "active" && STEPS.some(([k]) => k !== "line" && !m.onboarding.includes(k)) ? ` (ติดที่ ${nextStep(["line", ...m.onboarding])})` : ""}{m.onboarding.includes("scan") ? " · ขั้นสูง ✓" : m.onboarding.includes("connector") ? " · ขั้นสูง: ติดตั้งแล้ว" : ""} · AI วันนี้ {m.aiToday}/{m.limits?.aiPerDay}
                </div>
              </div>
              {m.status === "active" && (
                <div className={"mrow-plan " + m.plan}>
                  <b>{m.plan === "pro" ? "Pro" : "Free"}</b>
                  <small>{m.plan === "pro" ? (m.proUntil ? `ถึง ${short(m.proUntil)}` : "ไม่หมดอายุ") : "–"}{m.earlyAccess && m.plan === "pro" ? " · EA" : ""}</small>
                </div>
              )}
              {!m.owner ? <button className={"btn act-btn" + (openId === m.id ? " on" : "")} aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}>จัดการ</button> : <span />}
              {m.pendingOrder && (
                <div className="act-row order-row">
                  <button className="btn primary" onClick={() => set(m.id, null, { approve: true })}>อนุมัติ · เปิด Pro {orderOf(m.pendingOrder.plan).span}</button>
                  {m.pendingOrder.slipAt
                    ? <button className="btn" onClick={() => set(m.id, null, { reject: true })}>สลิปไม่ผ่าน</button>
                    : <button className="btn" onClick={() => confirm(`เอา ${m.name} ออกจาก "รอสลิป"? ไม่แจ้งลูกค้า · ถ้าเขาส่งสลิปมาภายหลัง (ภายใน 7 วัน) จะกลับมาให้ตรวจเอง`) && set(m.id, null, { cancelOrder: true })}>เอาออกจากรอสลิป</button>}
                  <span className="hint">{m.pendingOrder.slipAt ? "ดูสลิปในแชท LINE OA ก่อนกดอนุมัติ ระบบจะแจ้งลูกค้าในแชทให้เอง" : `เลือกแพ็กเมื่อ ${short(m.pendingOrder.at)} · ยังไม่ส่งสลิป (ระบบเอาออกเองเมื่อครบ 24 ชม.)`}</span>
                </div>
              )}
              {openId === m.id && (
                <div className="act-row">
                  {m.admin && <button className="btn danger-ghost" onClick={() => confirm(`ถอด ${m.name} ออกจากผู้ดูแล? (จะได้ Pro 30 วันแทน)`) && set(m.id, null, { admin: false })}>ถอดผู้ดูแล</button>}
                  {m.status === "active" && !m.admin && <>
                    <button className="btn" onClick={() => confirm(`ตั้ง ${m.name} เป็นผู้ดูแล? จะเข้าหน้านี้ได้ อนุมัติสลิป และได้ Pro ไม่หมดอายุ`) && set(m.id, null, { admin: true })}>ตั้งเป็นผู้ดูแล</button>
                    <GrantPicker m={m} campaigns={data.campaigns} cap={data.freeDaysCap} onGrant={(key) => set(m.id, null, { grant: key })} />
                    {!m.founding && <button className="btn" onClick={() => (m.promoLive ? confirm(`ยกเลิกข้อเสนอ ฿99 ของ ${m.name}?`) : confirm(`ส่งการ์ดข้อเสนอ ฿99/เดือน · ฿990/ปี ให้ ${m.name}? ใช้ได้ 48 ชม. ลูกค้ากด "สนใจ" แล้วระบบส่ง QR ให้เอง`)) && set(m.id, null, { founding: !m.promoLive })}>{m.promoLive ? "ยกเลิกข้อเสนอ ฿99" : m.promo?.at ? "🎁 ส่ง ฿99 อีกครั้ง" : "🎁 เสนอ ฿99"}</button>}
                    <button className="btn primary" onClick={() => set(m.id, null, { plan: "pro", days: 30 })}>Pro +30 วัน</button>
                    <button className="btn" onClick={() => set(m.id, null, { plan: "pro", days: 365 })}>Pro +1 ปี</button>
                    {m.plan === "pro" && <button className="btn" onClick={() => set(m.id, null, { plan: "free" })}>เปลี่ยนเป็น Free</button>}
                  </>}
                  {m.status !== "active" && <button className="btn primary" onClick={() => set(m.id, "active")}>เปิดสิทธิ์ (ได้ Pro 30 วัน)</button>}
                  {m.status !== "revoked" && <button className="btn danger-ghost" onClick={() => set(m.id, "revoked")}>ระงับ</button>}
                </div>
              )}
            </div>
          ))}
          {shown.length > limit && <>
            <MoreOnScroll onShow={() => setLimit((n) => n + PAGE)} />
            <button className="btn" style={{ margin: "10px auto", display: "flex" }} onClick={() => setLimit((n) => n + PAGE)}>แสดงเพิ่ม ({(shown.length - limit).toLocaleString("en-US")} คน)</button>
          </>}
            </>;
          })()}
        </div>
        {(data.toWelcome > 0 || stats.wait > 0 || welcomeMsg) && (
          <div className="bar">
            <button className="btn primary" disabled={welcomeMsg === "กำลังส่ง…"} onClick={async () => {
              setWelcomeMsg("กำลังส่ง…");
              const r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ welcomeFree: true }) }).then((x) => x.json()).catch(() => ({ error: "เชื่อมต่อไม่ได้" }));
              setWelcomeMsg(r.ok ? `ส่งแจ้ง "ใช้ฟรีได้แล้ว" ทาง LINE ${r.sent} คน` : "ไม่สำเร็จ: " + (r.error || ""));
              load();
            }}>แจ้งคน Free ใหม่ทาง LINE ({data.toWelcome + stats.wait} คน)</button>
            {welcomeMsg && <span className="hint">{welcomeMsg}</span>}
          </div>
        )}
        {data.announce?.filter((x) => x.left > 0 || x.sent > 0).map((x) => (
          <div key={x.key} className="bar">
            <button className="btn" disabled={!x.left || annMsg === "กำลังส่ง…"} onClick={async () => {
              if (!confirm(`ส่ง "${x.label}" ทาง LINE ให้ ${x.left} คน? (ใช้โควตา push ${x.left} ข้อความ · คนละครั้ง)`)) return;
              setAnnMsg("กำลังส่ง…");
              const r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ announce: x.key }) }).then((j) => j.json()).catch(() => ({ error: "เชื่อมต่อไม่ได้" }));
              setAnnMsg(r.ok ? `📣 ส่งแล้ว ${r.sent} คน${r.failed ? ` · ไม่สำเร็จ ${r.failed}` : ""}` : "ไม่สำเร็จ: " + (r.error || ""));
              load();
            }}>📣 {x.label} ({x.left ? `${x.left} คน` : `ส่งครบแล้ว ${x.sent} คน`})</button>
            {annMsg && <span className="hint">{annMsg}</span>}
          </div>
        ))}
        {data.requests?.length > 0 && (
          <div className="panel" style={{ margin: "12px 0" }}>
            <h2 style={{ marginTop: 0 }}>คนค้นหาแต่ไม่มีในคลังกลาง</h2>
            <p className="hint">เพิ่มเป็นหมวดในคลังกลางได้ เรียงตามจำนวนคน</p>
            {data.requests.map((x) => <div key={x.kw} className="bar" style={{ justifyContent: "space-between" }}><span>{x.kw}</span><span className="hint"><b className="num">{x.people}</b> คน · {x.count} ครั้ง · {short(x.last)}</span></div>)}
          </div>
        )}
        <div className="bar">
          <button className="btn" disabled={menuMsg === "กำลังติดตั้ง…"} onClick={async () => {
            setMenuMsg("กำลังติดตั้ง…");
            const r = await fetch("/api/admin/richmenu", { method: "POST" }).then((x) => x.json()).catch(() => ({ error: "เชื่อมต่อไม่ได้" }));
            setMenuMsg(r.ok ? "อัปเดตเมนู LINE แล้ว (ปิดแล้วเปิดแชทใหม่เพื่อดู)" : "ไม่สำเร็จ: " + (r.error || ""));
          }}>อัปเดต Rich menu ใน LINE</button>
          {menuMsg && <span className="hint">{menuMsg}</span>}
        </div>
        <p className="hint">จำนวนที่นั่ง Early Access ตั้งใน Vercel env <code>EARLY_ACCESS_SEATS</code> · EA = Early Access</p>
      </>}
    </div>
  );
}
