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

  async function set(id, status) {
    const r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }).then((x) => x.json());
    if (r.error) setErr(r.error); else load();
  }

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <header className="top">
        <div><h1>จัดการสมาชิก</h1><p className="sub">Early Access ของปั๊กปัก</p></div>
        <a className="btn" href="/">← กลับไปปั๊กปัก</a>
      </header>
      {err && <p className="hint">{err}</p>}
      {data && <>
        <p className="hint">ใช้ที่ไป <b className="num">{data.active}</b> จาก {data.seats} ที่ · จำนวนที่ตั้งได้ใน Vercel env <code>EARLY_ACCESS_SEATS</code></p>
        <div className="list">
          {!data.members.length && <div className="empty"><strong>ยังไม่มีสมาชิก</strong></div>}
          {data.members.map((m) => (
            <div key={m.id} className="admin-row">
              {m.picture ? <img className="avatar" style={{ width: 36, height: 36 }} src={m.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar" />}
              <div style={{ minWidth: 0 }}>
                <div className="name">{m.name} {m.admin && <span className="tag">admin</span>}</div>
                <div className="meta">
                  <span className={"tag" + (m.status === "active" ? " a" : m.status === "waitlist" ? " b" : "")}>{STATUS[m.status]}</span>
                  <span>สมัคร {new Date(m.joinedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                  <span>AI วันนี้ <span className="num">{m.aiToday}</span></span>
                  {m.status === "active" && <span title={STEPS.map(([k, l]) => (m.onboarding.includes(k) ? "✓ " : "· ") + l).join("\n")}>เริ่มต้น <span className="num">{m.onboarding.length}/4</span>{m.onboarding.length < 4 ? ` · ติดที่: ${nextStep(m.onboarding)}` : ""}</span>}
                </div>
              </div>
              {!m.admin && (
                <div className="bar">
                  {m.status !== "active" && <button className="btn primary" onClick={() => set(m.id, "active")}>เปิดสิทธิ์</button>}
                  {m.status === "active" && <button className="btn" onClick={() => set(m.id, "waitlist")}>ย้ายไปคิว</button>}
                  {m.status !== "revoked" && <button className="btn" onClick={() => set(m.id, "revoked")}>ระงับ</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
