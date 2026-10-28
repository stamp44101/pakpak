"use client";
import { useEffect, useState } from "react";

const STATUS = { active: "ใช้งานได้", waitlist: "รอคิว", revoked: "ระงับ" };
const STEPS = [["line", "เข้าสู่ระบบ"], ["bot", "เพิ่มเพื่อนบอท"], ["applink", "เอาลิงก์จากแอป"]];
const nextStep = (done) => (STEPS.find(([k]) => !done.includes(k)) || [null, "ครบแล้ว"])[1];

export default function Admin() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);
  const [menuMsg, setMenuMsg] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");

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
        <a className="btn" href="/">← กลับไปปั๊กปัก</a>
      </header>
      {err && <p className="hint">{err}</p>}
      {data && <>
        <div className="stats">
          <span><b className="num">{stats.pro}</b> Pro</span>
          <span><b className="num">{stats.free}</b> Free</span>
          <span><b className="num">{stats.wait}</b> รอคิว</span>
          {data.members.some((m) => m.pendingOrder?.slipAt) && <span className="stat-alert"><b className="num">{data.members.filter((m) => m.pendingOrder?.slipAt).length}</b> สลิปรอตรวจ</span>}
          <span>Early Access เหลือ <b className="num">{Math.max(0, data.seats - data.active)}</b>/{data.seats}</span>
        </div>
        <div className="list">
          {!data.members.length && <div className="empty"><strong>ยังไม่มีสมาชิก</strong></div>}
          {data.members.map((m) => (
            <div key={m.id} className="mrow">
              {m.picture ? <img className="avatar" src={m.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar" />}
              <div className="mrow-main">
                <div className="mrow-name">{m.name}{m.pendingOrder && <span className={"tag order" + (m.pendingOrder.slipAt ? " slip" : "")}>{m.pendingOrder.slipAt ? "ส่งสลิปแล้ว" : "เลือกแพ็กแล้ว รอสลิป"} · {m.pendingOrder.plan === "year" ? "รายปี" : "รายเดือน"}</span>}{m.admin && <span className="tag">เจ้าของ</span>}{m.status !== "active" && <span className={"tag" + (m.status === "waitlist" ? " b" : "")}>{STATUS[m.status]}</span>}</div>
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
              {!m.admin ? <button className={"btn act-btn" + (openId === m.id ? " on" : "")} aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}>จัดการ</button> : <span />}
              {m.pendingOrder && (
                <div className="act-row order-row">
                  <button className="btn primary" onClick={() => set(m.id, null, { approve: true })}>อนุมัติ · เปิด Pro {m.pendingOrder.plan === "year" ? "1 ปี" : "30 วัน"}</button>
                  <button className="btn" onClick={() => set(m.id, null, { reject: true })}>สลิปไม่ผ่าน</button>
                  <span className="hint">ดูสลิปในแชท LINE OA ก่อนกดอนุมัติ ระบบจะแจ้งลูกค้าในแชทให้เอง</span>
                </div>
              )}
              {openId === m.id && (
                <div className="act-row">
                  {m.status === "active" && <>
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
