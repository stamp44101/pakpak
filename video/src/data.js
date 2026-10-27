export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const VO_OFFSET = 0.3; // VO starts 0.3s into the timeline
export const TOTAL_SEC = 60;

// seconds on the timeline (VO word time + offset)
export const vo = (t) => t + VO_OFFSET;
export const f = (sec) => Math.round(sec * FPS);

// Scene boundaries (timeline seconds), cut on VO sentence starts (vo2.mp3)
export const SCENES = {
  hook: [0, 3.35],
  problem: [3.35, 8.15],
  logo: [8.15, 12.45],
  signup: [12.45, 17.65],
  top5: [17.65, 24.15],
  score: [24.15, 30.45],
  ai: [30.45, 35.4],
  link: [35.4, 41.8],
  pro: [41.8, 48.55],
  brand: [48.55, 53.1],
  cta: [53.1, TOTAL_SEC],
};

// Captions follow the ElevenLabs word timestamps (raw VO seconds). *word* = highlight.
export const CAPTIONS = [
  [0.16, 1.55, "ถ่ายมาสิบคลิป…"],
  [1.6, 3.0, "ขายได้ *คลิปเดียว*?"],
  [3.2, 5.52, "ปัญหามักไม่ใช่ฝีมือถ่าย…"],
  [5.56, 7.7, "แต่เป็น *ตะกร้า* ที่เลือกตั้งแต่แรก"],
  [12.32, 14.5, "สมัครด้วย *LINE* ปุ่มเดียว"],
  [14.56, 17.3, "ใช้บนมือถือ *ไม่ต้องเปิดคอม*"],
  [17.52, 18.95, "กด *ท็อป 5 วันนี้*"],
  [19.04, 21.12, "ตะกร้าน่าทำคลิปทุกหมวด"],
  [21.2, 23.9, "พร้อม *ค่าคอม* + เงินต่อออเดอร์"],
  [24.0, 27.25, "คะแนนเต็ม 100 จาก *ข้อมูลจริง*"],
  [27.4, 30.1, "+ *AI* ดูว่าเล่าเป็นคลิปได้ไหม"],
  [30.32, 33.5, "กด *ให้ AI ดู* ได้ hook 3 วิแรก"],
  [33.6, 35.1, "+ มุมเล่าคลิปทันที"],
  [35.28, 38.45, "แอป Shopee → *แชร์* → คัดลอก"],
  [38.56, 41.45, "ได้ *ลิงก์ของคุณเอง*"],
  [41.68, 43.85, "อยากได้มากกว่านั้น → *Pro*"],
  [52.96, 54.2, "*เริ่มใช้ฟรี* วันนี้"],
  [54.32, 57.9, "Early Access ใช้ *Pro ฟรี 30 วัน*"],
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

export const TOP5 = PRODUCTS.slice().sort((a, b) => b.total - a.total).slice(0, 5);

export const TOP_AI = {
  hook: "ทอดไก่ทั้งตัว ไม่ใช้น้ำมันสักหยด… แล้วกรอบกว่าเดิม?",
  angles: ["เทียบก่อน-หลัง ทอดน้ำมัน vs หม้อทอด", "เมนู 3 อย่างใน 10 นาทีหลังเลิกงาน", "รีวิวล้างง่าย ถอดตะแกรงเข้าเครื่องล้างจาน"],
  scores: { problem: 9, visual: 9, multi: 8 },
};

export const fmt = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 1 });
export const baht = (n) => "฿" + Math.round(+n || 0).toLocaleString("en-US");
