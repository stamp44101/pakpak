import { test } from "node:test";
import assert from "node:assert/strict";
import { matchProducts, parseReading, mediaType } from "./vision.js";
import { photoSearchFor, bucket } from "./flags.js";

const P = (id, name, category, sold = 100) => ({ id, name, category, sold, price: 199, commission: 10, rating: 4.8, reviews: 50 });
const pool = [
  P("1_1", "สายนาฬิกา ซิลิโคน สำหรับ Apple Watch", "สมาร์ทวอทช์", 500),
  P("1_2", "สายนาฬิกา สแตนเลส", "สมาร์ทวอทช์", 5000),
  P("1_3", "พัดลมพกพา USB", "แก็ดเจ็ต", 900),
  P("1_4", "เคสซิลิโคน iPhone", "แก็ดเจ็ต", 900),
];

test("match: more keywords first, then catalog score", () => {
  const r = matchProducts(pool, { type: "สายนาฬิกา", keywords: ["สายนาฬิกา", "ซิลิโคน", "apple watch"], category: "สมาร์ทวอทช์" });
  assert.deepEqual(r.map((p) => p.id), ["1_1", "1_2", "1_4"]);
  assert.ok(r[0]._t > 0); // ranked, so bubble() can show the score
});
test("match: category alone is not a hit", () => {
  assert.deepEqual(matchProducts(pool, { type: "ไม้แขวนเสื้อ", keywords: ["ไม้แขวน"], category: "แก็ดเจ็ต" }), []);
});
test("match: empty reading finds nothing", () => {
  assert.deepEqual(matchProducts(pool, { keywords: [] }), []);
});
test("reading: cleaned, 5 keywords max, unknown category dropped", () => {
  const r = parseReading({ kind: "product", type: ' "พัดลม"\n', keywords: ["พัดลม", "พัดลม", "a", "usb", "พกพา", "มินิ", "ตั้งโต๊ะ", "ชาร์จ"], category: "ไม่มีหมวดนี้" }, ["แก็ดเจ็ต"]);
  assert.equal(r.type, "พัดลม");
  assert.deepEqual(r.keywords, ["พัดลม", "usb", "พกพา", "มินิ", "ตั้งโต๊ะ"]);
  assert.equal(r.category, "");
  assert.equal(parseReading({ kind: "weird" }).kind, "other");
});
test("media type from bytes", () => {
  assert.equal(mediaType("", Buffer.from([0xff, 0xd8, 0xff])), "image/jpeg");
  assert.equal(mediaType("image/jpeg", Buffer.from([0x89, 0x50, 0x4e, 0x47])), "image/png");
  assert.equal(mediaType("text/plain", Buffer.from([0, 0])), "image/jpeg");
});
test("flag: off / admin / percent", () => {
  const m = { id: "U123" };
  assert.equal(photoSearchFor({}, m), false);
  assert.equal(photoSearchFor({ photoSearch: "off" }, m, { adminPreview: true }), false);
  assert.equal(photoSearchFor({ photoSearch: "admin" }, m), false);
  assert.equal(photoSearchFor({ photoSearch: "admin" }, m, { adminPreview: true }), true);
  assert.equal(photoSearchFor({ photoSearch: "100" }, m), true);
  assert.equal(photoSearchFor({ photoSearch: "20" }, m), bucket("photo:U123") < 20);
  process.env.PHOTO_SEARCH = "off";
  assert.equal(photoSearchFor({ photoSearch: "100" }, m, { adminPreview: true }), false);
  delete process.env.PHOTO_SEARCH;
});
