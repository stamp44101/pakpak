import { PRICE, PLANS } from "./plan";
import { RULES } from "./access";
// Shared with the bot: "you can use ปั๊กปัก for free now", with the Free limits spelled out.
export function freeWelcome(m, rules = RULES.free) {
  const lim = (t) => ({ type: "box", layout: "baseline", spacing: "sm", contents: [{ type: "text", text: "✓", size: "sm", color: "#FE6A0E", flex: 0 }, { type: "text", text: t, size: "sm", color: "#444444", wrap: true }] });
  return { type: "flex", altText: "ปั๊กปักเปิดให้ใช้ฟรีแล้ว 🎉", contents: {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: [
      { type: "text", text: "เปิดให้ใช้ฟรีแล้ว 🎉", weight: "bold", size: "lg" },
      { type: "text", text: `คุณ${m.name || ""} ไม่ต้องรอคิวแล้ว ใช้ปั๊กปักแบบ Free ได้ทันที`, size: "sm", color: "#666666", wrap: true },
      { type: "box", layout: "vertical", spacing: "xs", contents: [lim(rules.oneCat ? `ดูตะกร้าวันละ 1 หมวด อัปเดตจากยอดขายจริง` : `ดูตะกร้า ${rules.show} ตัว/หมวด อัปเดตจากยอดขายจริง`), lim(`ให้ AI คิด hook คลิป ${rules.aiPerDay} ครั้ง/วัน`), lim(rules.linksPerDay === Infinity ? "ลิงก์แอฟของตัวเองด้วย Affiliate ID" : `ลิงก์แอฟของตัวเองด้วย Affiliate ID ${rules.linksPerDay} ลิงก์/วัน`)] },
      { type: "text", text: `อยากปลดล็อคท็อป 1–5 + AI ${PLANS.pro.aiPerDay} ครั้ง/วัน → Pro ฿${PRICE.month}/เดือน`, size: "xs", color: "#999999", wrap: true },
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "button", style: "primary", color: "#FE6A0E", height: "sm", action: { type: "message", label: "ดูท็อป 5 วันนี้", text: "ท็อป" } },
      { type: "button", style: "link", height: "sm", action: { type: "message", label: "ดูแพ็ก Pro", text: "อัปเกรด Pro" } },
    ] },
  } };
}
