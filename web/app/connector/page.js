export const metadata = { title: "ติดตั้ง ปั๊กปัก Connector" };

export default function Connector() {
  return (
    <div className="wrap" style={{ maxWidth: 680 }}>
      <h1>ติดตั้ง ปั๊กปัก Connector</h1>
      <p className="sub">ส่วนเสริม Chrome ที่ให้ปั๊กปักอ่านสินค้าและสร้างลิงก์จาก Shopee Affiliate ที่คุณล็อกอินไว้ ไม่เก็บรหัสผ่านหรือ cookie</p>
      <ol className="panel" style={{ paddingLeft: 36, gap: 10 }}>
        <li><a className="btn primary" href="/pukpak-connector.zip" download>ดาวน์โหลด Connector (.zip)</a> แล้วแตกไฟล์</li>
        <li>เปิด <code>chrome://extensions</code> ในแถบที่อยู่ของ Chrome</li>
        <li>เปิด <b>Developer mode</b> มุมขวาบน</li>
        <li>กด <b>Load unpacked</b> แล้วเลือกโฟลเดอร์ที่แตกไว้</li>
        <li>กลับมาที่ปั๊กปัก แล้วกด “ตรวจอีกครั้ง”</li>
      </ol>
      <p className="hint">เมื่อขึ้น Chrome Web Store แล้ว ขั้นตอนนี้จะเหลือแค่กด “Add to Chrome”</p>
      <a className="btn" href="/">← กลับไปปั๊กปัก</a>
    </div>
  );
}
