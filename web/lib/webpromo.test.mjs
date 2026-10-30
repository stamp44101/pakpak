import { test } from "node:test";
import assert from "node:assert/strict";
import { webPromoFor } from "./plan.js";

const free = { status: "active", plan: "free" };
const day = 864e5;

test("Free active member sees the web promo", () => {
  assert.equal(webPromoFor(free)?.key, "q199");
});
test("Pro (dated or lifetime) never sees it", () => {
  assert.equal(webPromoFor({ ...free, plan: "pro", proUntil: Date.now() + day }), null);
  assert.equal(webPromoFor({ ...free, plan: "pro", proUntil: null }), null);
});
test("expired Pro counts as Free", () => {
  assert.equal(webPromoFor({ ...free, plan: "pro", proUntil: Date.now() - day })?.key, "q199");
});
test("admins, non-active, pending orders and live ฿99 offers are excluded", () => {
  assert.equal(webPromoFor(free, { admin: true }), null);
  assert.equal(webPromoFor({ ...free, status: "waitlist" }), null);
  assert.equal(webPromoFor({ ...free, status: "revoked" }), null);
  assert.equal(webPromoFor({ ...free, pendingOrder: { plan: "q199", at: Date.now() } }), null);
  assert.equal(webPromoFor({ ...free, foundingOffer: true, promo: { until: Date.now() + day } }), null);
  assert.equal(webPromoFor(null), null);
});
