// Client-safe: maps a URL to a collection slug without shipping the (Pro-only) product data in lib/collections.js.
export const SLUGS = ["stockpile"];
// LINE card links already sent carry ?src=line_stock… / line_pro… — they all mean the stockpile collection.
export const slugFromQuery = (q) => {
  // Opened through liff.line.me/<id>/?src=… : LINE lands on /?liff.state=%2F%3Fsrc%3D… and only liff.init()
  // would unpack it — signed-in members never run init, so read the inner query here.
  const st = q.get("liff.state");
  if (st && !q.get("c") && !q.get("src")) { const i = st.indexOf("?"); if (i >= 0) return slugFromQuery(new URLSearchParams(st.slice(i + 1))); }
  const c = q.get("c");
  if (c && SLUGS.includes(c)) return c;
  return /^line_(stock|pro)/.test(q.get("src") || "") ? "stockpile" : "";
};
