import { test } from "node:test";
import assert from "node:assert/strict";
import { blockReason, grantsOf, freeDaysOf, isLive, messageFor } from "./campaigns.js";

const c = { key: "x", label: "X", days: 3, perMember: 1, who: "all", active: true };
const free = (extra) => ({ name: "A", status: "active", plan: "free", ...extra });

test("legacy trial/follow records count as grants", () => {
  const m = free({ trialAt: 1, followReward: { at: 2, by: "Ainz" } });
  assert.deepEqual(grantsOf(m).map((g) => g.campaign), ["trial7", "follow-igfb"]);
  assert.equal(freeDaysOf(m), 10);
});
test("once per member, cap, who, live", () => {
  assert.equal(blockReason(free(), c), "");
  assert.match(blockReason(free({ grants: [{ campaign: "x", days: 3, at: 1 }] }), c), /ไปแล้ว/);
  assert.match(blockReason(free({ grants: [{ campaign: "y", days: 12, at: 1 }] }), c), /เพดาน/);
  assert.match(blockReason(free(), { ...c, who: "pro" }), /สำหรับคน Pro/);
  assert.match(blockReason({ ...free(), plan: "pro", proUntil: null }, c), /ไม่มีวันหมด/);
  assert.equal(isLive({ ...c, endAt: Date.now() - 1 }), false);
});
test("message placeholders", () => {
  assert.match(messageFor({ ...c, message: "+{days} ถึง {until}" }, { proUntil: Date.now() }), /^\+3 ถึง /);
});
