import { test } from "node:test";
import assert from "node:assert/strict";
import { webPromoFor, ORDERS } from "./plan.js";

const free = { status: "active", plan: "free" };
const day = 864e5;
// Fixed clocks around the promo's end, so results don't depend on today's date.
const during = ORDERS.q199.until - day;
const after = ORDERS.q199.until + 1;
const at = (now, extra) => ({ now, ...extra });

test("Free active member sees the web promo while it runs", () => {
  assert.equal(webPromoFor(free, at(during))?.key, "q199");
});
test("nobody sees it after the promo ends", () => {
  assert.equal(webPromoFor(free, at(after)), null);
  assert.equal(webPromoFor({ ...free, plan: "pro", proUntil: Date.now() - day }, at(after)), null);
});
test("Pro (dated or lifetime) never sees it", () => {
  assert.equal(webPromoFor({ ...free, plan: "pro", proUntil: Date.now() + day }, at(during)), null);
  assert.equal(webPromoFor({ ...free, plan: "pro", proUntil: null }, at(during)), null);
});
test("expired Pro counts as Free", () => {
  assert.equal(webPromoFor({ ...free, plan: "pro", proUntil: Date.now() - day }, at(during))?.key, "q199");
});
test("admins, non-active, pending orders and live ฿99 offers are excluded", () => {
  assert.equal(webPromoFor(free, at(during, { admin: true })), null);
  assert.equal(webPromoFor({ ...free, status: "waitlist" }, at(during)), null);
  assert.equal(webPromoFor({ ...free, status: "revoked" }, at(during)), null);
  assert.equal(webPromoFor({ ...free, pendingOrder: { plan: "q199", at: Date.now() } }, at(during)), null);
  assert.equal(webPromoFor({ ...free, foundingOffer: true, promo: { until: Date.now() + day } }, at(during)), null);
  assert.equal(webPromoFor(null, at(during)), null);
});
