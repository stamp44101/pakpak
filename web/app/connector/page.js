"use client";
import { useState } from "react";

export default function Connector() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText("chrome://extensions"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <div className="wrap" style={{ maxWidth: 680 }}>
      <div>
        <p className="hint" style={{ margin: "0 0 6px" }}>ขั้นสูง · ไม่บังคับ</p>
        <h1>ลิงก์อัตโนมัติ + สแกนหมวดของคุณเอง</h1>
        <p className="sub">ติดตั้งส่วนเสริม Chrome “ปั๊กปัก Connector” บนคอม แล้วระบบจะสร้างลิงก์ affiliate ของคุณให้ Top 20 ทุกหมวด และสแกนคำค้นอะไรก็ได้ ไม่เก็บรหัสผ่านหรือ cookie · ทำครั้งเดียวราว 3 นาที</p>
        <p className="hint" style={{ marginTop: 8 }}>ไม่ติดตั้งก็ใช้ปั๊กปักได้ปกติ: ดูท็อปจากคลังกลางในแชท LINE และเอาลิงก์ผ่านแอป Shopee (กดแชร์ → คัดลอก)</p>
      </div>
      <ol className="panel install">
        <li>
          <b>ดาวน์โหลดไฟล์ แล้วแตก zip</b>
          <p className="hint">ดับเบิลคลิกไฟล์ที่โหลดมา จะได้โฟลเดอร์ชื่อ <code>pukpak-connector</code></p>
          <a className="btn primary" href="/pukpak-connector.zip" download>ดาวน์โหลด Connector (.zip)</a>
        </li>
        <li>
          <b>เปิดหน้าส่วนเสริมของ Chrome</b>
          <p className="hint">คัดลอกแล้ววางในแถบที่อยู่ของ Chrome แล้วกด Enter (ลิงก์นี้กดตรงๆ ไม่ได้ Chrome ไม่อนุญาต)</p>
          <div className="bar"><code className="linkbox">chrome://extensions</code><button className="btn" onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</button></div>
        </li>
        <li>
          <b>เปิด Developer mode</b>
          <p className="hint">สวิตช์อยู่มุมขวาบนของหน้า Extensions</p>
        </li>
        <li>
          <b>กด Load unpacked แล้วเลือกโฟลเดอร์ที่แตกไว้</b>
          <p className="hint">ปุ่มอยู่มุมซ้ายบน จะเห็นการ์ด “ปั๊กปัก Connector” ขึ้นมา แนะนำให้กดไอคอนจิ๊กซอว์แล้วปักหมุดไว้</p>
        </li>
        <li>
          <b>กลับไปที่ปั๊กปัก แล้วล็อกอิน Shopee Affiliate</b>
          <p className="hint">ระบบจะเห็น Connector เอง กด “เชื่อม Shopee Affiliate” ล็อกอินตามปกติ แล้วกดหมวดแรกเพื่อสแกน</p>
          <a className="btn" href="/">← กลับไปปั๊กปัก</a>
        </li>
      </ol>
      <p className="hint">เมื่อขึ้น Chrome Web Store แล้ว ขั้นตอนนี้จะเหลือแค่กด “Add to Chrome”</p>
    </div>
  );
}
