// Checks on data a member's browser sends before it is stored.

// Link fields of a saved product end up as href= in the web app — for every member, once the owner's scans
// become the shared catalog — and "javascript:" in an href runs when clicked. Only http(s) links (or a link
// with no scheme at all) are kept; anything else is dropped from the product.
const LINK_FIELDS = ["url", "affLink", "longLink"];
export function safeLink(v) {
  if (typeof v !== "string") return false;
  const s = v.replace(/[\u0000- ]/g, ""); // browsers ignore these inside a scheme ("java\tscript:")
  const scheme = s.match(/^([a-z][a-z0-9+.-]*):/i);
  return !scheme || /^https?$/i.test(scheme[1]);
}

// products = { "<shopId>_<itemId>": {...} } as saved by PUT /api/state. Returns null when it isn't that shape.
export function safeProducts(products) {
  if (!products || typeof products !== "object" || Array.isArray(products)) return null;
  const out = {};
  for (const [id, p] of Object.entries(products)) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const q = { ...p };
    for (const k of LINK_FIELDS) if (q[k] != null && q[k] !== "" && !safeLink(q[k])) delete q[k];
    out[id] = q;
  }
  return out;
}
