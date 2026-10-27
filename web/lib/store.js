// Server-only helpers around the private Vercel Blob store.
import { put, get, del } from "@vercel/blob";

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
