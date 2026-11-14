import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionCookie, readSessionValue } from "./auth.js";

const value = () => sessionCookie("U123").split(";")[0].split("=")[1];
const env = (vars) => { delete process.env.SESSION_SECRET; delete process.env.LINE_CHANNEL_SECRET; Object.assign(process.env, vars); };

test("without SESSION_SECRET, cookies are still signed with the LINE_CHANNEL_SECRET key (no forced logout)", () => {
  env({ LINE_CHANNEL_SECRET: "line" });
  const v = value();
  assert.equal(readSessionValue(v).sub, "U123");
  env({ SESSION_SECRET: "line" }); // same derivation, so same key
  assert.equal(readSessionValue(v).sub, "U123");
});
test("SESSION_SECRET signs the cookie; LINE_CHANNEL_SECRET alone can no longer forge it", () => {
  env({ SESSION_SECRET: "s3cret", LINE_CHANNEL_SECRET: "line" });
  const v = value();
  assert.equal(readSessionValue(v).sub, "U123");
  env({ LINE_CHANNEL_SECRET: "line" });
  assert.equal(readSessionValue(v), null);
});
test("no secret at all means no session", () => {
  env({});
  assert.equal(readSessionValue("e30.x"), null);
});
