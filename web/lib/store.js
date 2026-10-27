// Server-only helpers around the private Vercel Blob store.
import { put, get, del } from "@vercel/blob";

const OPTS = { access: "private" };

// null only when the file really does not exist; transient Blob failures are retried, then thrown,
// so callers never mistake a hiccup for "this member does not exist".
export async function readJSON(path) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await get(path, { ...OPTS, useCache: false });
      if (!r || r.statusCode === 404) return null;
      if (r.statusCode === 200 && r.stream) return JSON.parse(await new Response(r.stream).text());
      last = new Error("blob status " + r.statusCode);
    } catch (e) {
      if (e && (e.name === "BlobNotFoundError" || /not.?found/i.test(String(e.message)))) return null;
      last = e;
    }
    await new Promise((ok) => setTimeout(ok, 200 * (i + 1)));
  }
  throw last;
}

export async function writeJSON(path, data) {
  await put(path, JSON.stringify(data), { ...OPTS, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}

export async function remove(path) {
  try { await del(path); } catch {}
}
