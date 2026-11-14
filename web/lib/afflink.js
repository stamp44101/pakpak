// Shopee affiliate link from a member's own Affiliate ID (an_redir). Works on server and client.
export const SUB_ID = "pakpak";

// Affiliate ID = digits only (e.g. 15372150047). Spaces/dashes from copy-paste are ignored.
export function parseAffId(t) {
  const s = String(t || "").replace(/[\s-]/g, "");
  return /^\d{6,15}$/.test(s) ? s : null;
}

// Any Shopee product URL → clean https://shopee.co.th/product/SHOP/ITEM (drops the long name + tracking).
export function cleanProductUrl(u) {
  let s = String(u || "");
  for (let i = 0; i < 3; i++) { try { const d = decodeURIComponent(s); if (d === s) break; s = d; } catch { break; } }
  const m = s.match(/-i\.(\d+)\.(\d+)/) || s.match(/\/product\/(\d+)\/(\d+)/) || s.match(/\/(\d{3,})\/(\d{5,})(?:[/?#]|$)/);
  return m ? `https://shopee.co.th/product/${m[1]}/${m[2]}` : null;
}

export function affLink(productUrl, affId, sub = SUB_ID) {
  const origin = cleanProductUrl(productUrl) || productUrl;
  return `https://s.shopee.co.th/an_redir?origin_link=${encodeURIComponent(origin)}&affiliate_id=${affId}&sub_id=${encodeURIComponent(sub)}`;
}

export const AFF_ID_HOW = "ดู Affiliate ID ได้ที่ affiliate.shopee.co.th (หน้าบัญชีของคุณ) เป็นตัวเลขยาว ๆ เช่น 15372150047";
export const SHORT_NOTE = "หมายเหตุ: หากต้องการลิงก์สั้น กรุณาแปลงลิงก์ด้วยตัวเอง";

export const isShortLink = (u) => /^(https?:\/\/)?(s\.shopee\.co\.th|shp\.ee|shope\.ee)\//i.test(String(u || ""));

// Server only: follow a short link (s.shopee.co.th/xxxx, shp.ee/xxxx) to the product page. null if it isn't a product.
// Only Shopee's own hosts are fetched, over https: a redirect that points anywhere else (another site, an
// internal address) is not followed.
const SHOPEE_HOST = /(^|\.)(shopee\.co\.th|shp\.ee|shope\.ee)$/i;
export function shopeeHttps(u) {
  try { const x = new URL(/^https?:\/\//i.test(u) ? u : "https://" + u); return x.protocol === "https:" && !x.port && !x.username && SHOPEE_HOST.test(x.hostname) ? x.toString() : null; } catch { return null; }
}
export async function resolveShortLink(u) {
  let cur = u;
  for (let i = 0; i < 6; i++) {
    const hit = cleanProductUrl(cur);
    if (hit) return hit;
    cur = shopeeHttps(cur);
    if (!cur) return null;
    const r = await fetch(cur, { method: "GET", redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }, signal: AbortSignal.timeout(5000) }).catch(() => null);
    const next = r && r.status >= 300 && r.status < 400 && r.headers.get("location");
    if (!next) return null;
    cur = new URL(next, cur).toString();
  }
  return cleanProductUrl(cur);
}
