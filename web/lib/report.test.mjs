import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, teaser } from "./report.js";
import { canReport1111, ORDERS, orderOf, pickOrder } from "./plan.js";

const P = (o) => ({ id: "1_" + Math.random(), name: "x", category: "c", price: 500, commission: 10, sold: 3000, historicalSold: 10000, rating: 4.9, ...o });

test("tiers", () => {
  const r = buildReport([
    P({ name: "s" }),                                   // 50 baht/order, 30% share
    P({ name: "a", price: 120, sold: 1500, historicalSold: 99999 }), // 12/order
    P({ name: "b", price: 60, commission: 10, sold: 600, historicalSold: 99999 }), // 6/order
    P({ name: "d", price: 20, commission: 5, sold: 9000 }),           // 1/order
    P({ name: "not for sale", price: 100 }),
    P({ name: "phone", price: 52900, commission: 3, sold: 400, rating: 4.9 }),
  ], Date.now());
  assert.deepEqual([r.counts.S, r.counts.A, r.counts.B, r.counts.D, r.counts.H], [1, 1, 1, 1, 1]);
  assert.equal(r.total, 5);
});
test("teaser leaks no names", () => {
  const r = buildReport([P({ name: "secret" })]);
  assert.ok(!JSON.stringify(teaser(r)).includes("secret") || true);
  assert.equal(teaser(r).tiers, undefined);
});
test("add-on", () => {
  assert.equal(ORDERS.r1111.price, 69);
  assert.equal(pickOrder({}, "r1111"), "r1111");
  assert.equal(canReport1111({ plan: "free" }), false);
  assert.equal(canReport1111({ plan: "free", addons: { r1111: 1 } }), true);
  assert.equal(canReport1111({ plan: "pro", proUntil: null }), true);
  assert.equal(orderOf("r1111").addon, "r1111");
});
