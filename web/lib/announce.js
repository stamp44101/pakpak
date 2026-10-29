// One-time LINE announcements sent from /admin to a target group, once per member (m.news[key] = sent time).
import { PLANS, isPro } from "./plan";
import { IDEA_EXTRA } from "./ai";

const ideas5 = () => ({ type: "flex", altText: `✨ สิทธิ์ใหม่สำหรับ Pro: ไอเดียคลิปส่วนตัว ${IDEA_EXTRA + 1} แบบต่อตะกร้า`, contents: {
  type: "bubble",
  body: { type: "box", layout: "vertical", spacing: "md", contents: [
    { type: "text", text: "✨ สิทธิ์ใหม่ของ Pro", weight: "bold", size: "lg", color: "#E5480A" },
    { type: "text", text: `ไอเดียคลิปส่วนตัว ${IDEA_EXTRA + 1} แบบต่อตะกร้า`, weight: "bold", size: "md", wrap: true },
    { type: "text", text: "ก่อนหน้านี้ ใครเปิดตะกร้าเดียวกันก็ได้ hook ประโยคเดียวกัน ตอนนี้ Pro กด \"🔄 ไอเดียใหม่\" ได้อีก 4 แบบ เป็นของคุณคนเดียว คนอื่นไม่เห็น ไม่ซ้ำกัน", size: "sm", color: "#555555", wrap: true },
    { type: "text", text: `• ทุกแบบเปลี่ยนวิธีเปิดคลิป กลุ่มคนดู หรือสถานการณ์ใช้งาน\n• เทสต์ได้หลาย hook ในตะกร้าเดียว\n• นับรวมในโควตา AI ${PLANS.pro.aiPerDay} ครั้ง/วันเดิม`, size: "sm", color: "#444444", wrap: true },
    { type: "text", text: "วิธีใช้: กด \"ดูไอเดียคลิป\" ใต้สินค้า แล้วกด \"🔄 ไอเดียใหม่\" ด้านล่างข้อความ", size: "xs", color: "#999999", wrap: true },
  ] },
  footer: { type: "box", layout: "vertical", contents: [
    { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "ดูท็อป 5 วันนี้", text: "ท็อป" } },
  ] },
} });

export const ANNOUNCE = {
  ideas5: { label: `ประกาศ Pro: ไอเดียส่วนตัว ${IDEA_EXTRA + 1} แบบ`, to: (m, admins) => m.status === "active" && isPro(m) && !admins.includes(m.id), message: ideas5 },
};
