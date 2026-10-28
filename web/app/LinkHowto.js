"use client";
// "เอาลิงก์ของคุณเอง" in 4 steps, from a real screen recording (images in /public/howto).
const STEPS = [
  ["กด “เปิดลิงก์”", "แอป Shopee จะเปิดขึ้นมา (บนเว็บคือปุ่ม “เปิดในแอป Shopee”)"],
  ["กด “Allow”", "(ถ้ามีกล่องเด้งขึ้นมา)"],
  ["กดปุ่มแชร์ ↗", "อยู่มุมขวาบน"],
  ["กด “คัดลอกลิงก์”", "เสร็จแล้ว! เอาไปปักตะกร้าได้เลย"],
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
