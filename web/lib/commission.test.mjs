import test from "node:test";
import assert from "node:assert/strict";
import { commFields, commChange, commLabel } from "./commission.js";

const T = 1_800_000_000_000;

test("records a drop between scans", () => {
  const f = commFields({ commission: 12 }, { commission: 9 }, T);
  assert.deepEqual(f, { commPrev: 12, commChangedAt: T });
  const c = commChange({ commission: 9, ...f }, T + 864e5);
  assert.equal(c.down, true);
  assert.equal(commLabel(c), "คอมลด 12→9%");
});

test("keeps the earlier change when the rate is unchanged", () => {
  const f = commFields({ commission: 9, commPrev: 12, commChangedAt: T }, { commission: 9 }, T + 5);
  assert.deepEqual(f, { commPrev: 12, commChangedAt: T });
});

test("no change, new product, noise, and expiry", () => {
  assert.deepEqual(commFields(undefined, { commission: 9 }, T), {});
  assert.deepEqual(commFields({ commission: 9 }, { commission: 9.2 }, T), {});
  assert.equal(commChange({ commission: 9, commPrev: 12, commChangedAt: T }, T + 15 * 864e5), null);
  assert.equal(commLabel(commChange({ commission: 13, commPrev: 9, commChangedAt: T }, T)), "คอมขึ้น 9→13%");
});
