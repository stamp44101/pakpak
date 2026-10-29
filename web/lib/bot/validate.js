// Checks a LINE reply/push payload against the limits LINE rejects with a 400 — before we spend the
// replyToken (it works once; a rejected reply leaves the user with nothing). Returns a list of problems.
// Pure: no imports, so it also runs under `node --test` (see validate.test.mjs).

const LIMITS = {
  messages: 5,
  text: 5000,
  altText: 400,
  quickReply: 13,
  label: 20,
  quickText: 300,
  postback: 300,
  carousel: 12,
  bubbleSizes: ["nano", "micro", "deca", "hecto", "kilo", "mega", "giga"],
};

export function validateMessages(input) {
  const out = [];
  const messages = [].concat(input ?? []);
  if (!messages.length) out.push("no messages");
  if (messages.length > LIMITS.messages) out.push(`${messages.length} messages (max ${LIMITS.messages})`);
  messages.forEach((m, i) => {
    const at = `msg[${i}]`;
    if (!m || typeof m !== "object") return out.push(`${at}: not an object`);
    if (m.quickReply) checkQuick(m.quickReply, at, out);
    switch (m.type) {
      case "text":
        if (typeof m.text !== "string" || !m.text.trim()) out.push(`${at}: text is empty`);
        else if (m.text.length > LIMITS.text) out.push(`${at}: text ${m.text.length} chars (max ${LIMITS.text})`);
        break;
      case "flex":
        if (typeof m.altText !== "string" || !m.altText.trim()) out.push(`${at}: altText is empty`);
        else if (m.altText.length > LIMITS.altText) out.push(`${at}: altText ${m.altText.length} chars (max ${LIMITS.altText})`);
        checkFlex(m.contents, `${at}.contents`, out);
        break;
      case "image":
        for (const k of ["originalContentUrl", "previewImageUrl"]) if (!/^https:\/\//.test(m[k] || "")) out.push(`${at}: ${k} must be https`);
        break;
      case undefined:
        out.push(`${at}: missing type`);
        break;
      default:
        break; // sticker, video, template… not used by the bot; let LINE judge
    }
  });
  return out;
}

function checkQuick(q, at, out) {
  const items = q?.items;
  if (!Array.isArray(items) || !items.length) return out.push(`${at}: quickReply.items empty`);
  if (items.length > LIMITS.quickReply) out.push(`${at}: ${items.length} quick replies (max ${LIMITS.quickReply})`);
  items.forEach((it, j) => checkAction(it?.action, `${at}.quickReply[${j}]`, out, true));
}

function checkAction(a, at, out, isQuick) {
  if (!a || typeof a !== "object") return out.push(`${at}: action missing`);
  if (a.label != null && String(a.label).length > LIMITS.label) out.push(`${at}: label "${a.label}" ${String(a.label).length} chars (max ${LIMITS.label})`);
  if (isQuick && !a.label) out.push(`${at}: quick reply needs a label`);
  if (a.type === "message" && (typeof a.text !== "string" || !a.text || a.text.length > LIMITS.quickText)) out.push(`${at}: message action text empty or >${LIMITS.quickText}`);
  if (a.type === "postback" && (typeof a.data !== "string" || !a.data || a.data.length > LIMITS.postback)) out.push(`${at}: postback data empty or >${LIMITS.postback}`);
  if (a.type === "uri" && !/^(https?|line|tel|mailto):/.test(a.uri || "")) out.push(`${at}: uri invalid "${String(a.uri).slice(0, 40)}"`);
  if (a.type === "clipboard" && !a.clipboardText) out.push(`${at}: clipboardText empty`);
}

function checkFlex(c, at, out) {
  if (!c || typeof c !== "object") return out.push(`${at}: flex contents missing`);
  if (c.type === "carousel") {
    const bs = Array.isArray(c.contents) ? c.contents : [];
    if (!bs.length) out.push(`${at}: carousel empty`);
    if (bs.length > LIMITS.carousel) out.push(`${at}: ${bs.length} bubbles (max ${LIMITS.carousel})`);
    const sizes = new Set(bs.map((b) => b?.size || "mega"));
    if (sizes.size > 1) out.push(`${at}: carousel mixes bubble sizes (${[...sizes].join(", ")}) — LINE rejects this`);
    if (sizes.has("giga")) out.push(`${at}: giga bubbles are not allowed in a carousel`);
    bs.forEach((b, i) => checkBubble(b, `${at}[${i}]`, out));
  } else if (c.type === "bubble") {
    checkBubble(c, at, out);
  } else {
    out.push(`${at}: flex container must be bubble or carousel`);
  }
}

function checkBubble(b, at, out) {
  if (!b || b.type !== "bubble") return out.push(`${at}: not a bubble`);
  if (b.size && !LIMITS.bubbleSizes.includes(b.size)) out.push(`${at}: unknown bubble size "${b.size}"`);
  if (!b.body && !b.hero && !b.header && !b.footer) out.push(`${at}: bubble has no blocks`);
  if (b.hero) walk(b.hero, `${at}.hero`, out);
  for (const k of ["header", "body", "footer"]) if (b[k]) walk(b[k], `${at}.${k}`, out);
}

// Walk a Flex component tree: empty text, bad buttons, nested actions.
function walk(n, at, out) {
  if (!n || typeof n !== "object") return out.push(`${at}: invalid component`);
  if (n.action) checkAction(n.action, `${at}.action`, out, false);
  switch (n.type) {
    case "box":
      if (!Array.isArray(n.contents)) out.push(`${at}: box without contents`);
      else n.contents.forEach((x, i) => walk(x, `${at}[${i}]`, out));
      break;
    case "text":
      if (Array.isArray(n.contents) && n.contents.length) n.contents.forEach((x, i) => walk(x, `${at}.span[${i}]`, out));
      else if (typeof n.text !== "string" || n.text === "") out.push(`${at}: text component is empty`);
      break;
    case "span":
      if (typeof n.text !== "string" || n.text === "") out.push(`${at}: span is empty`);
      break;
    case "button":
      if (!n.action) out.push(`${at}: button without action`);
      else if (!n.action.label) out.push(`${at}: button needs a label`);
      break;
    case "image":
      if (!/^https:\/\//.test(n.url || "")) out.push(`${at}: image url must be https`);
      break;
    case "separator": case "filler": case "spacer": case "icon": case "video":
      break;
    default:
      out.push(`${at}: unknown component "${n.type}"`);
  }
}
