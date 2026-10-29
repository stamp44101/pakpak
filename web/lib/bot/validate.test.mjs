// node --test lib/bot/validate.test.mjs   (or `npm test` from web/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMessages } from "./validate.js";

const text = (t, quick) => ({ type: "text", text: t, ...(quick ? { quickReply: { items: quick } } : {}) });
const qr = (label, t = "x") => ({ type: "action", action: { type: "message", label, text: t } });
const btn = (label) => ({ type: "button", action: { type: "message", label, text: "x" } });
const bubble = (size, extra = {}) => ({ type: "bubble", ...(size ? { size } : {}), body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "hi" }] }, ...extra });
const flex = (contents, altText = "alt") => ({ type: "flex", altText, contents });
const carousel = (...bs) => ({ type: "carousel", contents: bs });

test("plain text passes", () => assert.deepEqual(validateMessages(text("สวัสดี")), []));
test("single message (not array) accepted", () => assert.deepEqual(validateMessages(flex(bubble("kilo"))), []));

test("empty / missing", () => {
  assert.ok(validateMessages([]).length);
  assert.ok(validateMessages(text("")).some((p) => /empty/.test(p)));
  assert.ok(validateMessages({ text: "x" }).some((p) => /missing type/.test(p)));
});

test("more than 5 messages", () => assert.ok(validateMessages(Array(6).fill(text("a"))).some((p) => /max 5/.test(p))));

test("carousel: mixed bubble sizes rejected (the 29 Oct bug), same size ok", () => {
  assert.ok(validateMessages(flex(carousel(bubble("kilo"), bubble()))).some((p) => /mixes bubble sizes/.test(p)));
  assert.ok(validateMessages(flex(carousel(bubble("kilo"), bubble("mega")))).some((p) => /mixes bubble sizes/.test(p)));
  assert.deepEqual(validateMessages(flex(carousel(bubble("kilo"), bubble("kilo"), bubble("kilo")))), []);
  assert.deepEqual(validateMessages(flex(carousel(bubble(), bubble()))), []);
});

test("carousel: max 12, no giga, not empty", () => {
  assert.ok(validateMessages(flex(carousel(...Array(13).fill(bubble("kilo"))))).some((p) => /max 12/.test(p)));
  assert.ok(validateMessages(flex(carousel(bubble("giga"), bubble("giga")))).some((p) => /giga/.test(p)));
  assert.ok(validateMessages(flex(carousel())).some((p) => /carousel empty/.test(p)));
});

test("altText limits", () => {
  assert.ok(validateMessages(flex(bubble("kilo"), "")).some((p) => /altText is empty/.test(p)));
  assert.ok(validateMessages(flex(bubble("kilo"), "x".repeat(401))).some((p) => /altText 401/.test(p)));
  assert.deepEqual(validateMessages(flex(bubble("kilo"), "x".repeat(400))), []);
});

test("button label ≤ 20", () => {
  const b = (label) => bubble("kilo", { footer: { type: "box", layout: "vertical", contents: [btn(label)] } });
  assert.ok(validateMessages(flex(b("x".repeat(21)))).some((p) => /label .* 21 chars/.test(p)));
  assert.deepEqual(validateMessages(flex(b("ปลดล็อคด้วย Pro"))), []);
});

test("quick reply: ≤ 13 items, label ≤ 20, needs label", () => {
  assert.ok(validateMessages(text("a", Array(14).fill(qr("x")))).some((p) => /14 quick replies/.test(p)));
  assert.ok(validateMessages(text("a", [qr("x".repeat(21))])).some((p) => /label/.test(p)));
  assert.ok(validateMessages(text("a", [{ type: "action", action: { type: "message", text: "x" } }])).some((p) => /needs a label/.test(p)));
  assert.deepEqual(validateMessages(text("a", Array(13).fill(qr("หมวด")))), []);
});

test("flex text component must not be empty", () => {
  const b = { type: "bubble", size: "kilo", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "" }] } };
  assert.ok(validateMessages(flex(b)).some((p) => /text component is empty/.test(p)));
});

test("postback data ≤ 300, uri scheme", () => {
  const b = (action) => bubble("kilo", { footer: { type: "box", layout: "vertical", contents: [{ type: "button", action }] } });
  assert.ok(validateMessages(flex(b({ type: "postback", label: "a", data: "x".repeat(301) }))).some((p) => /postback data/.test(p)));
  assert.ok(validateMessages(flex(b({ type: "uri", label: "a", uri: "ftp://x" }))).some((p) => /uri invalid/.test(p)));
  assert.deepEqual(validateMessages(flex(b({ type: "uri", label: "a", uri: "https://x.y" }))), []);
  assert.deepEqual(validateMessages(flex(b({ type: "clipboard", label: "a", clipboardText: "https://x.y" }))), []);
});

test("image message needs https", () => {
  assert.ok(validateMessages({ type: "image", originalContentUrl: "http://x", previewImageUrl: "https://x" }).some((p) => /https/.test(p)));
});
