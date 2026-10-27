"use client";
// "เอาลิงก์ของคุณเอง" in 4 steps, from a real screen recording (images in /public/howto).
const STEPS = [
  ["กดเปิดในแอป Shopee", "ที่สินค้า กด “เปิดในแอป Shopee” (ในแชท LINE คือ “เปิดลิงก์”)"],
  ["กด Allow", "ถ้ามีกล่องถามว่าจะเปิดแอปไหม กด Allow"],
  ["กดปุ่มแชร์", "ในหน้าสินค้าของแอป Shopee กดปุ่มแชร์ ↗ มุมขวาบน"],
  ["กดคัดลอกลิงก์", "ได้ลิงก์ affiliate ของคุณ พร้อมเห็นค่าคอมที่จะได้"],
];
export default function LinkHowto() {
  return (
    <ol className="howto" aria-label="วิธีเอาลิงก์ของคุณเอง 4 ขั้น">
      {STEPS.map(([t, d], i) => (
        <li key={t}>
          <div className="howto-img"><img src={`/howto/step${i + 1}.jpg`} alt={t} loading="lazy" /></div>
          <b>{i + 1}. {t}</b>
          <span>{d}</span>
        </li>
      ))}
    </ol>
  );
}
