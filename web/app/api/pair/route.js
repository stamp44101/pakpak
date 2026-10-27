// Link another device (e.g. a phone): the signed-in device gets a short code, the phone trades it for the sync key.
import { readJSON, writeJSON, remove, userKey, unauthorized } from "../../../lib/store";
import { randomInt } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TTL = 10 * 60 * 1000;

// create a code (needs the current device's key)
export async function POST(req) {
  const u = userKey(req);
  if (!u) return unauthorized();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await writeJSON(`pair/${code}.json`, { token: u.token, expires: Date.now() + TTL });
  return Response.json({ code, expires: Date.now() + TTL });
}

// claim a code from the new device
export async function PUT(req) {
  const { code } = (await req.json().catch(() => ({}))) || {};
  if (!/^\d{6}$/.test(String(code || ""))) return Response.json({ error: "รหัสต้องเป็นตัวเลข 6 หลัก" }, { status: 400 });
  const rec = await readJSON(`pair/${code}.json`);
  if (!rec || rec.expires < Date.now()) {
    if (rec) await remove(`pair/${code}.json`);
    return Response.json({ error: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 404 });
  }
  await remove(`pair/${code}.json`);
  return Response.json({ token: rec.token });
}
