// Static LINE messages must pass the validator, or LINE replies/pushes get blocked and users only see the fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMessages } from "./bot/validate.js";
import { freeWelcome } from "./welcome.js";
import { ANNOUNCE } from "./announce.js";
import { RULES } from "./access.js";

test("freeWelcome is valid for every Free rule set", () => {
  for (const [k, rules] of Object.entries(RULES)) if (rules && typeof rules === "object" && "aiPerDay" in rules)
    assert.deepEqual(validateMessages([freeWelcome({ name: "ทดสอบ" }, rules)]), [], k);
});
test("every announcement is valid", () => {
  for (const [k, a] of Object.entries(ANNOUNCE)) assert.deepEqual(validateMessages([a.message({ name: "ทดสอบ" })]), [], k);
});
