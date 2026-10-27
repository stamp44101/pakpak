// Server-only helpers around the private Vercel Blob store.
import { put, get, del } from "@vercel/blob";
import { createHash } from "crypto";

const OPTS = { access: "private" };

export async function readJSON(path) {
  try {
    const r = await get(path, { ...OPTS, useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (e && (e.name === "BlobNotFoundError" || /not.?found/i.test(String(e.message)))) return null;
    throw e;
  }
}

export async function writeJSON(path, data) {
  await put(path, JSON.stringify(data), { ...OPTS, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}

export async function remove(path) {
  try { await del(path); } catch {}
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

// A user is whoever holds their random sync key (created in the browser, never stored in clear on the server).
export function userKey(req) {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  return { token, id: sha("pukpak:" + token).slice(0, 40) };
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
