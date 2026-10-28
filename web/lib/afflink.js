// Shopee affiliate link from a member's own Affiliate ID (an_redir). Works on server and client.
export const SUB_ID = "pakpak";

// Affiliate ID = digits only (e.g. 15372150047). Spaces/dashes from copy-paste are ignored.
export function parseAffId(t) {
  const s = String(t || "").replace(/[\s-]/g, "");
  return /^\d{6,15}$/.test(s) ? s : null;
}

// Any Shopee product URL → clean https://shopee.co.th/product/SHOP/ITEM (drops the long name + tracking).
export function cleanProductUrl(u) {
  const s = String(u || "");
  const m = s.match(/-i\.(\d+)\.(\d+)/) || s.match(/\/product\/(\d+)\/(\d+)/) || s.match(/\/(\d{3,})\/(\d{5,})(?:[/?#]|$)/);
  return m ? `https://shopee.co.th/product/${m[1]}/${m[2]}` : null;
}

export function affLink(productUrl, affId, sub = SUB_ID) {
  const origin = cleanProductUrl(productUrl) || productUrl;
  return `https://s.shopee.co.th/an_redir?origin_link=${encodeURIComponent(origin)}&affiliate_id=${affId}&sub_id=${encodeURIComponent(sub)}`;
}

export const AFF_ID_HOW = "ดู Affiliate ID ได้ที่ affiliate.shopee.co.th (หน้าบัญชีของคุณ) เป็นตัวเลขยาว ๆ เช่น 15372150047";
export const SHORT_NOTE = "หมายเหตุ: หากต้องการลิงก์สั้น กรุณาแปลงลิงก์ด้วยตัวเอง";
