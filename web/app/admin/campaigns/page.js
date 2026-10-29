"use client";
import { useEffect, useState } from "react";

const WHO = { all: "ทุกคน", free: "เฉพาะ Free", pro: "เฉพาะ Pro" };
const blank = { key: "", label: "", days: 3, perMember: 1, who: "all", active: true, startAt: "", endAt: "", proof: "", message: "🎁 ขอบคุณที่ร่วมกิจกรรมกับปั๊กปักค่ะ\nได้ Pro เพิ่ม {days} วัน ใช้ได้ถึง {until}" };
// <input type="date"> works in local days; store ms (Bangkok) and show yyyy-mm-dd back.
const toDay = (t) => (t ? new Date(t + 7 * 36e5).toISOString().slice(0, 10) : "");
const fromDay = (d, end) => (d ? Date.parse(d + (end ? "T23:59:59+07:00" : "T00:00:00+07:00")) : "");
const short = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

export default function Campaigns() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/admin/campaigns").then((r) => r.json()).then((j) => (j.error ? setErr(j.error) : setData(j))).catch(() => setErr("โหลดไม่สำเร็จ"));
  useEffect(() => { load(); }, []);

  const edit = (c) => setForm(c ? { ...blank, ...c, startAt: toDay(c.startAt), endAt: toDay(c.endAt) } : { ...blank });
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  async function save(patch) {
    const body = { ...(patch || form) };
    body.startAt = patch ? patch.startAt : fromDay(form.startAt);
    body.endAt = patch ? patch.endAt : fromDay(form.endAt, true);
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => ({ error: "เชื่อมต่อไม่ได้" }));
    setBusy(false);
    if (r.error) return setErr(r.error);
    setForm(null); load();
  }

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <header className="top">
        <div><h1>แคมเปญ</h1><p className="hint" style={{ margin: 0 }}>ให้ Pro ฟรีจากกิจกรรม · ให้สิทธิ์ที่หน้าสมาชิก → จัดการ → 🎁</p></div>
        <div className="bar" style={{ gap: 6 }}><button className="btn primary" onClick={() => edit(null)}>+ แคมเปญใหม่</button><a className="btn" href="/admin">← สมาชิก</a></div>
      </header>
      {err && <p className="hint" style={{ color: "var(--bad)" }}>{err}</p>}
      {data && <p className="hint">คนหนึ่งได้วันฟรีจากทุกแคมเปญรวมกันไม่เกิน {data.cap} วัน เพื่อไม่ให้ของฟรีแทนการจ่าย</p>}

      {form && (
        <div className="list" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <b>{form.key ? `แก้ "${form.label}"` : "แคมเปญใหม่"}</b>
          <label>ชื่อแคมเปญ<br /><input className="grow" style={{ width: "100%" }} value={form.label} onChange={f("label")} placeholder="เช่น แชร์โพสต์ลง TikTok" maxLength={60} /></label>
          <div className="bar" style={{ gap: 10, flexWrap: "wrap" }}>
            <label>ให้ Pro (วัน)<br /><input type="number" min={1} max={data?.cap || 14} value={form.days} onChange={f("days")} style={{ width: 90 }} /></label>
            <label>คนละกี่ครั้ง<br /><input type="number" min={1} max={10} value={form.perMember} onChange={f("perMember")} style={{ width: 90 }} /></label>
            <label>ใครได้<br /><select value={form.who} onChange={f("who")}>{Object.entries(WHO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>เริ่ม<br /><input type="date" value={form.startAt} onChange={f("startAt")} /></label>
            <label>จบ<br /><input type="date" value={form.endAt} onChange={f("endAt")} /></label>
          </div>
          <label>แอดมินต้องตรวจอะไรก่อนกด<br /><input style={{ width: "100%" }} value={form.proof} onChange={f("proof")} placeholder="เช่น ติดตามทั้ง IG และ FB (ขอแคปหน้าจอในแชท OA)" maxLength={120} /></label>
          <label>ข้อความที่ลูกค้าได้ใน LINE · ใช้ {"{days}"} {"{until}"} {"{name}"} ได้<br /><textarea value={form.message} onChange={f("message")} rows={4} maxLength={900} style={{ width: "100%", font: "inherit", padding: 8, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={f("active")} /> เปิดใช้งาน</label>
          <div className="bar" style={{ gap: 6 }}><button className="btn primary" disabled={busy} onClick={() => save()}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button><button className="btn" onClick={() => setForm(null)}>ยกเลิก</button></div>
        </div>
      )}

      {!data && !err && <p className="hint">กำลังโหลด…</p>}
      {data && (
        <div className="list">
          {data.campaigns.map((c) => (
            <div key={c.key} style={{ padding: "14px 16px", borderTop: "1px solid var(--line)", opacity: c.live ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                <div>
                  <b>{c.label}</b> <span className="tag">{c.live ? "เปิดอยู่" : c.active ? "นอกช่วงเวลา" : "ปิด"}</span>
                  <div className="hint" style={{ fontSize: 12.5 }}>
                    Pro +{c.days} วัน · คนละ {c.perMember} ครั้ง · {WHO[c.who] || "ทุกคน"}{c.startAt || c.endAt ? ` · ${c.startAt ? short(c.startAt) : "…"} – ${c.endAt ? short(c.endAt) : "…"}` : ""}{c.proof ? ` · ตรวจ: ${c.proof}` : ""}
                  </div>
                </div>
                <div className="bar" style={{ gap: 6 }}>
                  <button className="btn" onClick={() => edit(c)}>แก้</button>
                  <button className="btn" disabled={busy} onClick={() => save({ ...c, active: !c.active })}>{c.active ? "ปิด" : "เปิด"}</button>
                </div>
              </div>
              <div className="stats" style={{ marginTop: 8 }}>
                <span>ให้ไป <b className="num">{c.granted}</b> คน</span>
                <span>จาก Free <b className="num">{c.fromFree}</b></span>
                <span>ยังเป็น Pro <b className="num">{c.activeNow}</b></span>
                <span title="คนที่จ่ายเงินหลังได้สิทธิ์จากแคมเปญนี้">จ่ายต่อ <b className="num">{c.paidAfter}</b>{c.granted ? ` (${Math.round((c.paidAfter / c.granted) * 100)}%)` : ""} · ฿<b className="num">{c.revenueAfter.toLocaleString("en-US")}</b></span>
              </div>
              {c.last.length > 0 && <div className="hint" style={{ fontSize: 12, marginTop: 6 }}>ล่าสุด: {c.last.map((x) => `${x.name} ${short(x.at)}${x.by ? ` (${x.by})` : ""}`).join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
