// Hand-picked "Trend Alert" collections (Pro only). Data, not code: add a new collection here
// and point the LINE card to /?c=<slug>. Free gets the title, count and locked teasers only.
import { isPro } from "./plan.js";

const P = (no, shopId, itemId, name, image, price, commission, sold, badge) =>
  ({ no, id: `${shopId}_${itemId}`, shopId, itemId, name, image, price, commission, sold, badge: badge || null, url: `https://shopee.co.th/product/${shopId}/${itemId}` });

export const COLLECTIONS = {
  stockpile: {
    title: "ของสำรองฉุกเฉิน 72 ชม.",
    note: "ทำคลิปโทน “เตรียมพร้อม ไม่ตื่นตระหนก” · เลี่ยงคำว่า ด่วน / สงคราม / รีบตุนก่อนหมด",
    updated: "4 พ.ย. 2569",
    groups: [
      ["🍚 อาหารหลัก", [
        P("1.1", 1374952286, 40158439872, "ข้าวหอมมะลิสำเภา 14+5 กก.", "th-11134207-81ztm-ms10smwmmvpeb7", 509, 7, "10K+"),
        P("1.2", 294954656, 25825082765, "Samyang Buldak ยกลัง 40 ซอง", "th-11134207-81ztm-mqq8itzgo7ij97", 1360, 7, "2K+", "คอม/ออเดอร์สูง"),
        P("1.3", 163965007, 23719666126, "ปลากระป๋องรุ่งอรุณ 10 กระป๋อง", "th-11134207-81ztm-mqj0z9lxzshs3d", 105, 7, "1K+"),
        P("1.4", 2047443, 44708271592, "ปลาซาร์ดีน SUMACO 5 กระป๋อง", "th-11134207-81ztq-mrbnq2whlbt399", 145, 11, "1K+"),
        P("1.5", 38948311, 18060692937, "นม UHT ยกลัง (ลังที่ 2 ฿199)", "th-11134207-81ztp-mu8170jjfmrl3a", 444, 10, "3K+"),
      ]],
      ["💧 น้ำ & ทำอาหารตอนไฟดับ", [
        P("2.1", 123188354, 49103888011, "น้ำแร่มองต์เฟลอ 1.5L แพ็ค", "th-11134207-81ztg-mtrlpec8qy9xb1", 144, 12, "2K+", "คอมสูง"),
        P("2.2", 1235433298, 29937157038, "ถังเก็บน้ำพับได้ มีก๊อก", "sg-11134201-7ratr-maijkuj2vw8z75", 58, 7, "1K+"),
        P("2.3", 133520052, 25307624232, "ขวดกรองน้ำพกพา PURE TO GO", "th-11134207-7r98t-lrsewfl92qppb3", 234, 9, "214"),
        P("3.1", 39109149, 2022932374, "เตาแก๊สปิคนิค Lucky Flame", "th-11134207-81ztd-ms0rdlpoirk24d", 883, 7, "565"),
        P("3.2", 163289763, 47600650343, "แก๊สกระป๋อง MAX FIRE 3 ชิ้น", "sg-11134201-821dm-mgitwmsk5rtb46", 107, 9, "7K+", "ปักง่ายสุด"),
      ]],
      ["🔦 ไฟ & พลังงาน", [
        P("4.1", 295718817, 4547504014, "ไฟฉุกเฉิน LED ชาร์จได้ YAGE", "4f341cc282931cf927e0e8fa45868166", 89, 11, "1K+"),
        P("4.2", 1513282823, 46053664872, "ถ่าน Panasonic ของแท้", "sg-11134201-820n5-mnf8ezfd0qo363", 59, 12, "3K+", "คอมสูง"),
        P("4.3", 28426506, 5606980067, "Powerbank Eloop E33", "sg-11134201-825au-muzxxh710t1e84", 263, 9, "3K+"),
        P("4.4", 1264202107, 44050307695, "วิทยุมือหมุนฉุกเฉิน + ไฟฉาย", "sg-11134201-7rff6-m9jwy6boz3fw67", 604, 8, "177", "ตลาดยังว่าง"),
      ]],
      ["🩹 ปฐมพยาบาล & เอาตัวรอด", [
        P("5.1", 177986479, 21660774315, "ชุดทำแผล KLEANSET", "th-11134207-81ztl-mlvu6ep3uigwa2", 16, 9, "541"),
        P("5.2", 1100917946, 48907229497, "ชุดเอาตัวรอดฉุกเฉินพกพา", "cn-11134207-820l4-mlswi9zn74zlde", 135, 13, "219", "คอมสูงสุด"),
        P("5.3", 67320011, 27606389016, "ผ้าห่มฉุกเฉิน 160×210 ซม.", "th-11134207-7r98v-ly7nguyts90p80", 15, 11, "306"),
      ]],
    ],
  },
};

export { slugFromQuery } from "./collection-slug.js";

// What a member may see. Free: title + group names + counts only (no names, links, ids or images).
export function collectionView(slug, m, { admin = false } = {}) {
  const c = COLLECTIONS[slug];
  if (!c) return null;
  const count = c.groups.reduce((n, [, items]) => n + items.length, 0);
  const head = { slug, title: c.title, updated: c.updated, count };
  if (admin || isPro(m)) return { ...head, pro: true, note: c.note, groups: c.groups.map(([name, items]) => ({ name, items })) };
  return { ...head, pro: false, groups: c.groups.map(([name, items]) => ({ name, n: items.length })) };
}
