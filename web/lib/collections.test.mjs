import { test } from "node:test";
import assert from "node:assert/strict";
import { collectionView, COLLECTIONS } from "./collections.js";
import { slugFromQuery, SLUGS } from "./collection-slug.js";

const pro = { plan: "pro", proUntil: Date.now() + 864e5 };
const free = { plan: "free" };

test("Free never gets product names, ids, links or images", () => {
  const v = collectionView("stockpile", free);
  assert.equal(v.pro, false);
  assert.equal(v.count, 17);
  const json = JSON.stringify(v);
  for (const k of ["shopee.co.th", "itemId", "image", "ข้าวหอมมะลิ", "MAX FIRE"]) assert.ok(!json.includes(k), `${k} leaked`);
});

test("Pro and admins see all 17 products", () => {
  for (const v of [collectionView("stockpile", pro), collectionView("stockpile", free, { admin: true })]) {
    assert.equal(v.pro, true);
    assert.equal(v.groups.flatMap((g) => g.items).length, 17);
  }
});

test("expired Pro is treated as Free", () => {
  assert.equal(collectionView("stockpile", { plan: "pro", proUntil: Date.now() - 1 }).pro, false);
});

test("LINE card links map to the collection", () => {
  const q = (s) => new URLSearchParams(s);
  assert.equal(slugFromQuery(q("src=line_pro3")), "stockpile");
  assert.equal(slugFromQuery(q("src=line_stock1")), "stockpile");
  assert.equal(slugFromQuery(q("c=stockpile")), "stockpile");
  assert.equal(slugFromQuery(q("c=nope")), "");
  assert.equal(slugFromQuery(q("")), "");
});

test("client slug list matches the collections", () => {
  assert.deepEqual(SLUGS.sort(), Object.keys(COLLECTIONS).sort());
});

test("slugFromQuery unpacks liff.state from liff.line.me links", async () => {
  const { slugFromQuery } = await import("./collection-slug.js");
  assert.equal(slugFromQuery(new URLSearchParams("liff.state=%2F%3Fsrc%3Dline_pro1")), "stockpile");
  assert.equal(slugFromQuery(new URLSearchParams("liff.state=%2F%3Fsrc%3Dline_stock_more")), "stockpile");
  assert.equal(slugFromQuery(new URLSearchParams("liff.state=%2F")), "");
  assert.equal(slugFromQuery(new URLSearchParams("src=line_pro3")), "stockpile");
});
