import { test } from "node:test";
import assert from "node:assert/strict";
import { complete, angleList } from "./ai.js";

test("idea cut off after the hook is incomplete (30 Oct bug)", () => {
  assert.equal(complete({ hook: "เจ้าของแมว…", angles: [], why: "" }), false);
  assert.equal(complete({ hook: "เจ้าของแมว…" }), false);
  assert.equal(complete({ hook: "h", angles: ["a"], why: "w" }), false);
});
test("full idea is complete", () => {
  assert.equal(complete({ hook: "h", angles: ["a", "b"], why: "w" }), true);
});
test("angles sent as one string are split", () => {
  assert.deepEqual(angleList("• ก\n• ข\n• ค\n• ง"), ["ก", "ข", "ค"]);
});
