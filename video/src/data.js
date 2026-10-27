export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const VO_OFFSET = 0.3; // VO starts 0.3s into the timeline
export const TOTAL_SEC = 54;
// extra VO line about LINE ปั๊กปัก is spliced in after the "มือถือ" sentence
export const SPLIT_RAW = 36.6; // raw VO time where the main take is cut
export const LINE_SHIFT = 6.0; // how much everything after the cut moves later
export const LINE_AT = 37.15; // timeline start of vo_line.mp3

// seconds on the timeline (VO word time + offset)
export const vo = (t) => t + VO_OFFSET + (t >= SPLIT_RAW - 0.05 ? LINE_SHIFT : 0);
export const f = (sec) => Math.round(sec * FPS);

// Scene boundaries (timeline seconds), cut on VO sentence starts
export const SCENES = {
  hook: [0, 3.95],
  problem: [3.95, 7.5],
  logo: [7.5, 11.0],
  connect: [11.0, 17.55],
  scan: [17.55, 26.25],
  detail: [26.25, 31.5],
  link: [31.5, 36.9],
  line: [36.9, 42.9],
  brand: [42.9, 47.0],
  cta: [47.0, TOTAL_SEC],
};

// Captions follow the ElevenLabs word timestamps. *word* = highlight.
export const CAPTIONS = [
  [0.08, 1.9, "ปักตะกร้าไปเป็นสิบคลิป…"],
  [2.0, 3.6, "ทำไมยังไม่มี *ออเดอร์*?"],
  [3.76, 5.36, "ปัญหาอาจไม่ใช่คลิป…"],
  [5.4, 7.1, "แต่คือ *ตะกร้า* ที่คุณเลือก"],
  [7.36, 8.8, "รู้จัก *ปั๊กปัก*!"],
  [10.8, 13.2, "แค่ล็อกอิน *Shopee Affiliate*"],
  [13.36, 14.85, "ติดตั้ง *Connector*"],
  [14.96, 17.1, "ไม่ต้องกรอก *API key*"],
  [17.36, 18.85, "เลือกหมวด → *กดสแกน*"],
  [18.96, 20.85, "คะแนนจาก *ข้อมูลจริง*"],
  [20.96, 22.85, "+ การวิเคราะห์ของ *AI*"],
  [22.96, 25.95, "คัดเหลือ *Top 10* ที่น่าปักที่สุด"],
  [26.08, 29.3, "บอกเหตุผลชัด ว่าทำไมน่าทำคลิป"],
  [29.36, 31.25, "พร้อม *hook* 3 วินาทีแรก"],
  [31.36, 33.3, "สร้างลิงก์ *affiliate* ได้ทันที"],
  [33.44, 36.5, "สแกนบนคอม → *ดูต่อบนมือถือ*"],
];
// captions for vo_line.mp3, in seconds from LINE_AT
export const LINE_CAPTIONS = [
  [0.0, 2.2, "หรือเปิดผ่าน *LINE ปั๊กปัก*"],
  [2.45, 5.5, "อัตโนมัติ *ไม่ต้องล็อกอินซ้ำ*"],
];

// Mock products (หมวด ห้องครัว). d = data score /60, a = AI score /40
export const PRODUCTS = [
  { id: "p1", icon: "fryer", hue: 18, name: "หม้อทอดไร้น้ำมัน 5 ลิตร หน้าจอสัมผัส ตั้งเวลาได้", price: 899, sold: 12400, com: 8, rating: 4.9, shop: "Mall", d: 52, a: 36 },
  { id: "p2", icon: "knife", hue: 140, name: "ที่หั่นผักอเนกประสงค์ 12 in 1 พร้อมกล่องรอง", price: 159, sold: 31200, com: 12, rating: 4.8, shop: "Preferred", d: 50, a: 35 },
  { id: "p3", icon: "dome", hue: 200, name: "ฝาครอบไมโครเวฟกันกระเด็น พับได้", price: 89, sold: 8100, com: 15, rating: 4.7, d: 44, a: 33 },
  { id: "p4", icon: "brush", hue: 280, name: "แปรงล้างขวด ด้ามยาว ขนซิลิโคน", price: 69, sold: 22000, com: 10, rating: 4.8, d: 46, a: 28 },
  { id: "p5", icon: "box", hue: 170, name: "กล่องเก็บอาหารสุญญากาศ ชุด 5 ใบ", price: 299, sold: 9600, com: 9, rating: 4.9, shop: "Mall", d: 47, a: 26 },
  { id: "p6", icon: "blender", hue: 330, name: "เครื่องปั่นพกพา ชาร์จ USB 380ml", price: 259, sold: 15000, com: 7, rating: 4.6, d: 42, a: 30 },
  { id: "p7", icon: "glove", hue: 0, name: "ถุงมือกันความร้อน ซิลิโคน 1 คู่", price: 99, sold: 5200, com: 14, rating: 4.7, d: 40, a: 29 },
  { id: "p8", icon: "knife", hue: 220, name: "ที่ลับมีด 3 ระดับ ฐานกันลื่น", price: 129, sold: 7700, com: 11, rating: 4.8, d: 41, a: 27 },
  { id: "p9", icon: "rack", hue: 40, name: "ชั้นวางเครื่องเทศหมุนได้ 360°", price: 349, sold: 3900, com: 10, rating: 4.7, d: 38, a: 27 },
  { id: "p10", icon: "sponge", hue: 55, name: "ฟองน้ำนาโนล้างจาน แพ็ค 10 ชิ้น", price: 49, sold: 40000, com: 6, rating: 4.6, d: 43, a: 21 },
  { id: "p11", icon: "pan", hue: 15, name: "กระทะเคลือบหินอ่อน 28 ซม.", price: 459, sold: 2100, com: 5, rating: 4.5, d: 33, a: 18 },
  { id: "p12", icon: "rack", hue: 190, name: "ตะแกรงคว่ำจาน 2 ชั้น สแตนเลส", price: 399, sold: 1400, com: 6, rating: 4.4, d: 30, a: 15 },
].map((p) => ({ ...p, total: p.d + p.a, perOrder: (p.price * p.com) / 100 }));

// order the scan "returns" them in
export const ARRIVAL = ["p6", "p10", "p3", "p11", "p1", "p8", "p12", "p5", "p2", "p9", "p4", "p7"];
export const RANKED = PRODUCTS.slice().sort((a, b) => b.total - a.total).map((p) => p.id);

export const TOP_AI = {
  hook: "ทอดไก่ทั้งตัว ไม่ใช้น้ำมันสักหยด… แล้วกรอบกว่าเดิม?",
  angles: ["เทียบก่อน-หลัง ทอดน้ำมัน vs หม้อทอด", "เมนู 3 อย่างใน 10 นาทีหลังเลิกงาน", "รีวิวล้างง่าย ถอดตะแกรงเข้าเครื่องล้างจาน"],
  why: "ปัญหา→ทางแก้เห็นชัดใน 3 วิ มีภาพหยุดนิ้วตอนเปิดฝา เล่าได้หลายมุม",
};

export const fmt = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 1 });
