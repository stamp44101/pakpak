"use client";
import { useState } from "react";

export default function Connector() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText("chrome://extensions"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <div className="wrap" style={{ maxWidth: 680 }}>
      <title>ติดตั้ง ปั๊กปัก Connector</title>
      <div>
        <h1>ติดตั้ง ปั๊กปัก Connector</h1>
        <p className="sub">ส่วนเสริม Chrome ที่ให้ปั๊กปักอ่านสินค้าและสร้างลิงก์จาก Shopee Affiliate ที่คุณล็อกอินไว้ ไม่เก็บรหัสผ่านหรือ cookie · ใช้เวลาราว 1 นาที · ใช้บนคอมกับ Chrome</p>
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
          <b>กลับไปที่ปั๊กปัก</b>
          <p className="hint">กด “ติดตั้งแล้ว ตรวจอีกครั้ง” ระบบจะติ๊กขั้นนี้ให้เอง</p>
          <a className="btn" href="/">← กลับไปปั๊กปัก</a>
        </li>
      </ol>
      <p className="hint">เมื่อขึ้น Chrome Web Store แล้ว ขั้นตอนนี้จะเหลือแค่กด “Add to Chrome”</p>
    </div>
  );
}
