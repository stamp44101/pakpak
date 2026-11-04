// Client-safe: maps a URL to a collection slug without shipping the (Pro-only) product data in lib/collections.js.
export const SLUGS = ["stockpile"];
// LINE card links already sent carry ?src=line_stock… / line_pro… — they all mean the stockpile collection.
export const slugFromQuery = (q) => {
  const c = q.get("c");
  if (c && SLUGS.includes(c)) return c;
  return /^line_(stock|pro)/.test(q.get("src") || "") ? "stockpile" : "";
};
