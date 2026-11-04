import { test } from "node:test";
import assert from "node:assert/strict";
import { orderOf, pickOrder, orderLive } from "./plan.js";

// Halloween q199 ended: no longer sellable, but members who bought it / still hold a q199 order keep its terms.
test("ended q199 can't be picked any more (falls back to month)", () => {
  assert.equal(orderLive("q199"), false);
  assert.equal(pickOrder({}, "q199"), "month");
});
test("q199 orders already placed keep 90 days, ฿199 and label", () => {
  const o = orderOf("q199");
  assert.equal(o.days, 90);
  assert.equal(o.price, 199);
  assert.equal(o.label, "โปรฮาโลวีน 3 เดือน");
});
test("regular and founding plans unchanged", () => {
  assert.equal(pickOrder({}, "year"), "year");
  assert.equal(pickOrder({}, "fmonth"), "month");
  assert.equal(pickOrder({ founding: true }, "fyear"), "fyear");
  assert.equal(pickOrder({}, "nope"), "month");
});
