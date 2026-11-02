import { test } from "node:test";
import assert from "node:assert/strict";
import { showcase } from "./showcase.js";
import { rank } from "./score.js";

const products = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i}`, name: `สินค้า ${i}`, image: `img${i}`, category: "ของใช้ในบ้าน",
  price: 100 + i * 10, commission: 5 + i, sold: 1000 * (i + 1), rating: 4.5, url: `https://shopee.co.th/product/1/${i}`, fetchedAt: 1,
}));

test("landing never exposes the top 5 of a category", () => {
  const [cat] = showcase(products);
  const top5 = rank(products).slice(0, 5).map((p) => p.id);
  const json = JSON.stringify(cat);
  for (const id of top5) assert.ok(!json.includes(`"${id}"`), `${id} leaked`);
  assert.deepEqual(cat.items.map((p) => p.rank), [6, 7, 8, 9, 10]);
});

test("locked teasers carry only rank, score and ≈฿/order", () => {
  const [cat] = showcase(products);
  assert.equal(cat.locked.length, 5);
  for (const l of cat.locked) assert.deepEqual(Object.keys(l).sort(), ["perOrder", "rank", "score"]);
});
