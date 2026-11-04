// Landing FAQ: one source for the visible <details> list and the FAQPage JSON-LD (Google wants them to match).
export const FAQ = [
  { q: "ต้องให้รหัส Shopee ไหม", a: "ไม่ต้อง ใช้งานปกติไม่ต้องเชื่อม Shopee เลย ถ้าเปิดขั้นสูง คุณล็อกอิน Shopee Affiliate เองใน Chrome ตามปกติ Connector แค่อ่านรายการสินค้าและสร้างลิงก์จากแท็บนั้น ไม่เก็บรหัสผ่านหรือ cookie" },
  { q: "ใช้แต่มือถือได้ไหม", a: "ได้ค่ะ ดูท็อปสินค้า ขอไอเดียคลิปจาก AI และได้ลิงก์ของคุณเองแค่ใส่ Shopee Affiliate ID ครั้งเดียว ทำได้ครบบนมือถือ คอมใช้เฉพาะ “ขั้นสูง” ถ้าอยากได้ลิงก์อัตโนมัติหรือสแกนหมวดเอง" },
  { q: "ลิงก์ที่ได้เป็นลิงก์ของใคร", a: "เป็นลิงก์ affiliate ของบัญชีคุณเอง สร้างจาก Shopee Affiliate ID ของคุณ ค่าคอมเข้าบัญชีคุณตามปกติ" },
  { q: "ใช้ฟรีได้แค่ไหน", a: "สมัครด้วย LINE แล้วใช้แพ็ก Free ได้ทันที ไม่ต้องจ่ายเงิน ได้ท็อป 5 ของทุกหมวดและ AI ไอเดียคลิปวันละ 3 ตัว ถ้าอยากดูได้ทุกตัวและใช้ AI มากขึ้นค่อยอัปเป็น Pro" },
  { q: "จ่ายเงินยังไง", a: "ทักแอดมินในแชท LINE ของปั๊กปัก แล้วโอนผ่านพร้อมเพย์ แอดมินเปิดสิทธิ์ Pro ให้ทันที" },
];

export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};
