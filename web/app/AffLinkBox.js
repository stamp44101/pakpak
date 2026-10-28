"use client";
// "เอาลิงก์ของฉัน": ask the member's Affiliate ID, then build their own affiliate link for this product.
import { useState } from "react";
import { parseAffId, affLink, AFF_ID_HOW, SHORT_NOTE } from "../lib/afflink";

const KEY = "pakpak.affId";
const get = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };

export default function AffLinkBox({ url, onDone, say }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const [link, setLink] = useState("");

  function make(e) {
    e.preventDefault();
    const id = parseAffId(val);
    if (!id) { setErr(true); setLink(""); return; }
    setErr(false);
    setLink(affLink(url, id));
    try { localStorage.setItem(KEY, id); } catch {}
    onDone?.();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); say?.("คัดลอกลิงก์แล้ว"); } catch { say?.(link); }
  }

  if (!open) return <button className="btn primary" onClick={() => { setVal(get()); setOpen(true); }}>เอาลิงก์ของฉัน</button>;
  return (
    <div className="afflink" style={{ width: "100%" }}>
      <form className="bar" onSubmit={make}>
        <input className="grow" inputMode="numeric" autoFocus placeholder="Affiliate ID เช่น 15372150047" value={val} onChange={(e) => { setVal(e.target.value); setErr(false); }} />
        <button className="btn primary" type="submit">ทำลิงก์</button>
      </form>
      {err && <p className="hint" style={{ color: "#E5480A" }}>ถ้าอยากได้ลิงก์แอฟของตัวเอง ต้องทราบ Affiliate ID ของตัวเองก่อน · {AFF_ID_HOW}</p>}
      {!err && !link && <p className="hint">อยากได้ลิงก์แอฟของตัวเอง ต้องมี Affiliate ID เท่านั้น · {AFF_ID_HOW}</p>}
      {link && <>
        <div className="linkbox">{link}</div>
        <div className="bar"><button className="btn primary" onClick={copy}>คัดลอกลิงก์</button></div>
        <p className="hint">{SHORT_NOTE}</p>
      </>}
    </div>
  );
}
