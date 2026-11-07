import test from "node:test";
import assert from "node:assert/strict";
import { moveOf, mvLabel, MV_SHOW } from "./moves.js";

const prev = ["a", "b", "c", "d"];
test("rank moves vs yesterday", () => {
  assert.equal(moveOf(prev, 1, "c"), 2); // was #3, now #1
  assert.equal(moveOf(prev, 4, "a"), -3); // was #1, now #4
  assert.equal(moveOf(prev, 2, "b"), null); // same place
  assert.equal(moveOf(prev, 5, "z"), "new"); // not in yesterday's list
  assert.equal(moveOf(prev, MV_SHOW + 1, "z"), null); // too far down to label
  assert.equal(moveOf(undefined, 1, "a"), null); // category had no snapshot
  assert.equal(moveOf([], 1, "a"), null);
});
test("labels", () => {
  assert.equal(mvLabel("new"), "🆕");
  assert.equal(mvLabel(3), "↑3");
  assert.equal(mvLabel(-2), "↓2");
  assert.equal(mvLabel(null), "");
});
