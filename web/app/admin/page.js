"use client";
import { useEffect, useState } from "react";

const STATUS = { active: "ใช้งานได้", waitlist: "รอคิว", revoked: "ระงับ" };
const STEPS = [["connector", "ติดตั้ง Connector"], ["shopee", "เชื่อม Shopee"], ["scan", "สแกนตะกร้าแรก"], ["ai", "ลอง AI"]];
const nextStep = (done) => (STEPS.find(([k]) => !done.includes(k)) || [null, "ครบแล้ว"])[1];

export default function Admin() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = () => fetch("/api/admin").then((r) => r.json()).then((j) => (j.error ? setErr(j.error) : setData(j))).catch(() => setErr("โหลดไม่สำเร็จ"));
  useEffect(() => { load(); }, []);

  async function set(id, status, extra) {
    document.querySelectorAll(".act[open]").forEach((d) => (d.open = false));
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
          <span>Early Access เหลือ <b className="num">{Math.max(0, data.seats - data.active)}</b>/{data.seats}</span>
        </div>
        <div className="list">
          {!data.members.length && <div className="empty"><strong>ยังไม่มีสมาชิก</strong></div>}
          {data.members.map((m) => (
            <div key={m.id} className="mrow">
              {m.picture ? <img className="avatar" src={m.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar" />}
              <div className="mrow-main">
                <div className="mrow-name">{m.name}{m.admin && <span className="tag">เจ้าของ</span>}{m.status !== "active" && <span className={"tag" + (m.status === "waitlist" ? " b" : "")}>{STATUS[m.status]}</span>}</div>
                <div className="mrow-sub">
                  สมัคร {short(m.joinedAt)} · เริ่มต้น {m.onboarding.length}/4{m.status === "active" && m.onboarding.length < 4 ? ` (ติดที่ ${nextStep(m.onboarding)})` : ""} · AI วันนี้ {m.aiToday}/{m.limits?.aiPerDay}
                </div>
              </div>
              {m.status === "active" && (
                <div className={"mrow-plan " + m.plan}>
                  <b>{m.plan === "pro" ? "Pro" : "Free"}</b>
                  <small>{m.plan === "pro" ? (m.proUntil ? `ถึง ${short(m.proUntil)}` : "ไม่หมดอายุ") : "–"}{m.earlyAccess && m.plan === "pro" ? " · EA" : ""}</small>
                </div>
              )}
              {!m.admin ? (
                <details className="act">
                  <summary className="btn">จัดการ</summary>
                  <div className="act-menu">
                    {m.status === "active" && <>
                      <button onClick={() => set(m.id, null, { plan: "pro", days: 30 })}>Pro +30 วัน</button>
                      <button onClick={() => set(m.id, null, { plan: "pro", days: 365 })}>Pro +1 ปี</button>
                      {m.plan === "pro" && <button onClick={() => set(m.id, null, { plan: "free" })}>เปลี่ยนเป็น Free</button>}
                      <hr />
                      <button onClick={() => set(m.id, "waitlist")}>ย้ายไปคิว</button>
                    </>}
                    {m.status !== "active" && <button onClick={() => set(m.id, "active")}>เปิดสิทธิ์ (ได้ Pro 30 วัน)</button>}
                    {m.status !== "revoked" && <button className="danger" onClick={() => set(m.id, "revoked")}>ระงับ</button>}
                  </div>
                </details>
              ) : <span />}
            </div>
          ))}
        </div>
        <p className="hint">จำนวนที่นั่ง Early Access ตั้งใน Vercel env <code>EARLY_ACCESS_SEATS</code> · EA = Early Access</p>
      </>}
    </div>
  );
}
