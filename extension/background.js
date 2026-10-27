// ปั๊กปัก Connector — runs Shopee Affiliate calls inside the user's own logged-in tab.
const AFF = "https://affiliate.shopee.co.th";
const AFF_HOME = AFF + "/offer/product_offer";

// ---------- injected into the Shopee Affiliate page (MAIN world) ----------
// Must be self-contained: Chrome serializes it. Uses XHR so Shopee's own SDK
// attaches its security headers to the request.
async function injected(op, arg) {
  const xhr = (method, url, body) => new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    x.withCredentials = true;
    x.setRequestHeader("Accept", "application/json, text/plain, */*");
    if (body) x.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    x.setRequestHeader("Affiliate-Program-Type", "1");
    x.onload = () => { try { resolve({ ok: true, json: JSON.parse(x.responseText) }); } catch (e) { resolve({ ok: false }); } };
    x.onerror = () => resolve({ ok: false });
    x.send(body || null);
  });

  if (op === "profile") {
    const r = await xhr("GET", "/api/v3/user/profile");
    if (!r.ok || !r.json) return { loggedIn: false, transient: true };
    if (r.json.code !== 0 || !r.json.data) return { loggedIn: false };
    return { loggedIn: true, name: r.json.data.name, affiliateId: r.json.data.affiliate_id };
  }

  if (op === "search") {
    const p = new URLSearchParams({
      list_type: String(arg.listType ?? 0), sort_type: String(arg.sortType ?? 2),
      page_offset: String(arg.offset ?? 0), page_limit: String(arg.limit ?? 20), client_type: "1",
    });
    if (arg.keyword) p.set("keyword", arg.keyword);
    const r = await xhr("GET", "/api/v3/offer/product/list?" + p);
    if (!r.ok || !r.json || r.json.code !== 0) return { error: "list_failed", code: r.json && r.json.code };
    const pct = (s) => parseFloat(String(s || "0").replace("%", "")) || 0;
    const items = (r.json.data.list || []).map((it) => {
      const c = it.batch_item_for_item_card_full || {};
      return {
        id: c.shopid + "_" + c.itemid, itemId: String(c.itemid), shopId: Number(c.shopid),
        name: c.name, image: c.image,
        price: Math.round(Number(c.price) / 1e5), priceMax: Math.round(Number(c.price_max) / 1e5),
        sold: c.sold, historicalSold: c.historical_sold,
        rating: Number((c.item_rating && c.item_rating.rating_star) || 0), reviews: c.cmt_count,
        commission: Math.max(pct(it.max_commission_rate), pct(it.seller_commission_rate), pct(it.default_commission_rate)),
        shop: c.is_official_shop ? "mall" : (c.is_preferred_plus_seller || c.shopee_verified ? "preferred" : ""),
        catId: c.catid, longLink: it.long_link, url: it.product_link,
      };
    });
    return { total: r.json.data.total_count, items };
  }

  if (op === "links") {
    const q = "query batchGetProductOfferLink($sourceCaller: SourceCaller!, $productOfferLinkParams: [ProductOfferLinkParam!]!, $advancedLinkParams: AdvancedLinkParams){ productOfferLinks(productOfferLinkParams: $productOfferLinkParams, sourceCaller: $sourceCaller, advancedLinkParams: $advancedLinkParams){ itemId shopId productOfferLink } }";
    const sub = arg.subIds || [];
    const body = JSON.stringify({
      operationName: "batchGetProductOfferLink", query: q,
      variables: {
        productOfferLinkParams: arg.items.map((i) => ({ itemId: String(i.itemId), shopId: Number(i.shopId), trace: "" })),
        sourceCaller: "WEB_SITE_CALLER",
        advancedLinkParams: { subId1: sub[0] || "", subId2: sub[1] || "", subId3: sub[2] || "", subId4: sub[3] || "", subId5: sub[4] || "" },
      },
    });
    const r = await xhr("POST", "/api/v3/gql?q=productOfferLinks", body);
    if (!r.ok || !r.json || r.json.errors || !r.json.data) return { error: "link_failed" };
    return { links: (r.json.data.productOfferLinks || []).map((l) => ({ itemId: String(l.itemId), shopId: Number(l.shopId), link: l.productOfferLink })) };
  }
  return { error: "unknown_op" };
}

// ---------- tab plumbing ----------
// The user never has to keep a Shopee Affiliate tab open: we open one in the
// background when needed, keep Chrome from discarding it, recover it if it
// goes stale, and close it again after a few idle minutes.
const IDLE_CLOSE_MIN = 3;

const getOwn = async () => (await chrome.storage.session.get("ownTab")).ownTab ?? null;
const setOwn = (id) => chrome.storage.session.set({ ownTab: id });

async function findTab() {
  const tabs = await chrome.tabs.query({ url: AFF + "/*" });
  const own = await getOwn();
  // prefer a live user tab, then our own tab, then anything
  return tabs.find((t) => t.id !== own && t.status === "complete" && !t.discarded)
    || tabs.find((t) => t.id === own)
    || tabs.find((t) => !t.discarded)
    || tabs[0] || null;
}

function waitLoaded(tabId, ms = 25000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = async () => {
      try {
        const t = await chrome.tabs.get(tabId);
        if (t.status === "complete" && !t.discarded) return setTimeout(() => resolve(t), 1500); // let Shopee's SDK boot
      } catch { return resolve(null); }
      if (Date.now() - t0 > ms) return resolve(null);
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function reloadTab(tab) {
  try { await chrome.tabs.reload(tab.id); } catch { return null; }
  return waitLoaded(tab.id);
}

async function ensureTab({ focus = false } = {}) {
  let tab = await findTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: AFF_HOME, active: focus });
    await setOwn(tab.id);
    tab = await waitLoaded(tab.id);
  } else if (tab.discarded || tab.status === "unloaded" || !tab.url) {
    tab = await reloadTab(tab);
  } else if (tab.status !== "complete") {
    tab = await waitLoaded(tab.id);
  }
  if (!tab) return null;
  chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
  if (focus) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  return tab;
}

async function exec(tab, op, arg) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, world: "MAIN", func: injected, args: [op, arg ?? {}],
    });
    return res ? res.result : { error: "no_result" };
  } catch (e) {
    return { error: "exec_failed" };
  }
}

// Not logged in = the tab ended up off affiliate.shopee.co.th (login redirect)
// or the profile API says so. Anything else is treated as a stale tab: reload once and retry.
const transient = (op, r) => !r || r.error === "exec_failed" || r.error === "no_result" || r.error === "list_failed" || r.error === "link_failed" || (op === "profile" && r.transient);

async function runInTab(tab, op, arg) {
  if (!tab) return { error: "tab_failed" };
  if (!tab.url || !tab.url.startsWith(AFF)) return { error: "not_logged_in" };
  let r = await exec(tab, op, arg);
  if (transient(op, r)) {
    const t2 = await reloadTab(tab);
    if (!t2) return { error: "tab_failed" };
    if (!t2.url || !t2.url.startsWith(AFF)) return { error: "not_logged_in" };
    r = await exec(t2, op, arg);
  }
  return r;
}

async function run(op, arg) {
  const tab = await ensureTab();
  const r = await runInTab(tab, op, arg);
  if (r && r.error === "not_logged_in") await chrome.storage.local.remove("account");
  chrome.alarms.create("closeOwnTab", { delayInMinutes: IDLE_CLOSE_MIN });
  return r;
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "closeOwnTab") return;
  const own = await getOwn();
  if (own == null) return;
  try {
    const t = await chrome.tabs.get(own);
    if (!t.active) await chrome.tabs.remove(own); // never close it while the user is looking at it
  } catch {}
  await setOwn(null);
});
chrome.tabs.onRemoved.addListener(async (id) => { if (id === (await getOwn())) await setOwn(null); });

// ---------- message API (called by the ปั๊กปัก web app) ----------
async function handle(msg) {
  switch (msg && msg.type) {
    case "ping":
      return { ok: true, version: chrome.runtime.getManifest().version };
    case "status": {
      const p = await run("profile");
      if (p && p.loggedIn) { await chrome.storage.local.set({ account: p }); return { ...p, tab: true }; }
      return { loggedIn: false, tab: true, error: p && p.error };
    }
    case "openLogin": {
      const tab = await ensureTab({ focus: true });
      await setOwn(null); // the user is using this tab now — don't auto-close it
      if (tab && tab.url && !tab.url.startsWith(AFF)) await chrome.tabs.update(tab.id, { url: AFF_HOME });
      return { ok: true };
    }
    case "search":
      return run("search", msg.opts || {});
    case "links": {
      const items = (msg.items || []).slice(0, 20);
      if (!items.length) return { links: [] };
      return run("links", { items, subIds: msg.subIds });
    }
    default:
      return { error: "unknown_type" };
  }
}

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  handle(msg).then(sendResponse, (e) => sendResponse({ error: String(e && e.message || e) }));
  return true;
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg).then(sendResponse, (e) => sendResponse({ error: String(e && e.message || e) }));
  return true;
});
