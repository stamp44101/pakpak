"use client";
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { effPrice, rank } from "../lib/score";
import Landing from "./Landing";
import AffLinkBox from "./AffLinkBox";

const bkkToday = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2012241865-bvKNVlJR";
const inLine = () => typeof navigator !== "undefined" && /\bLine\//i.test(navigator.userAgent);
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
const EXT_ID = process.env.NEXT_PUBLIC_EXT_ID || "oemnhmceapililgkfdfjamhbdpkkjbbm";
const PRESETS = [
  ["ของใช้ในบ้าน", ["ที่เก็บของ", "ไม้ถูพื้น"]],
  ["ห้องครัว", ["อุปกรณ์ครัว", "หม้อทอดไร้น้ำมัน"]],
  ["ความงาม", ["กันแดด", "ที่ม้วนผม"]],
  ["แก็ดเจ็ต", ["พัดลมพกพา", "หูฟังบลูทูธ"]],
  ["สัตว์เลี้ยง", ["ของเล่นแมว", "ทรายแมว"]],
  ["ขนม", ["ขนม"]],
  ["สมาร์ทวอทช์", ["สมาร์ทวอทช์"]],
  ["เครื่องมือช่าง", ["เครื่องมือช่าง"]],
  ["เครื่องใช้ไฟฟ้า", ["เครื่องใช้ไฟฟ้า"]],
  ["เสื้อผ้าผู้หญิง", ["เสื้อผ้าผู้หญิง"]],
];
const STORE = "pukpak.v1";
const DAY = 864e5, STALE_MS = 3 * DAY;
const ago = (t) => { if (!t) return "ไม่ทราบ"; const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? "วันนี้" : d === 1 ? "เมื่อวาน" : `${d} วันก่อน`; };
const img = (id, size = "_tn") => (id ? `https://down-th.img.susercontent.com/file/${id}${size}` : "");
const fmt = (n) => (n == null || isNaN(n) ? "–" : Number(n).toLocaleString("th-TH", { maximumFractionDigits: 1 }));

// ---- talk to the ปั๊กปัก Connector extension ----
function ext(msg, timeout = 30000) {
  return new Promise((resolve) => {
    const rt = typeof window !== "undefined" && window.chrome && window.chrome.runtime;
    if (!rt || !rt.sendMessage) return resolve({ error: "no_extension" });
    const t = setTimeout(() => resolve({ error: "timeout" }), timeout);
    try {
      rt.sendMessage(EXT_ID, msg, (res) => {
        clearTimeout(t);
        if (rt.lastError || !res) return resolve({ error: "no_extension" });
        resolve(res);
      });
    } catch { clearTimeout(t); resolve({ error: "no_extension" }); }
  });
}

const ls = {
  get(k) { try { return localStorage.getItem(STORE + k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(STORE + k) : localStorage.setItem(STORE + k, v); } catch {} },
};
async function api(path, method = "GET", body) {
  const r = await fetch(path, { method, credentials: "same-origin", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  if (!r) return { error: "เชื่อมต่อ server ไม่ได้" };
  return r.json().catch(() => ({ error: "server error " + r.status }));
}
function loadLocal() { try { return JSON.parse(ls.get("") || "{}"); } catch { return {}; } }

export default function Home({ signedIn = false }) {
  const [me, setMe] = useState(null); // {member, seats, left, loginReady}
  // the server saw a valid session cookie: never flash the landing page while /api/me loads
  const [signedHint, setSignedHint] = useState(signedIn);
  const [extOk, setExtOk] = useState(null);
  const [account, setAccount] = useState(null); // live Shopee Affiliate session via Connector
  const [linked, setLinked] = useState(null); // Shopee account name saved on the member
  const [remoteLive, setRemoteLive] = useState(null); // {live, at} last Shopee status reported from the computer
  const [products, setProducts] = useState({});
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState("");
  const [cat, setCat] = useState("");
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState("");
  const [aiBusy, setAiBusy] = useState(null);
  const [open, setOpen] = useState(null);
  const [ideas, setIdeas] = useState({}); // Pro: personal extra ideas per product id → { list, left }
  const [ideaBusy, setIdeaBusy] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  const [freeSeen, setFreeSeen] = useState(true);
  useEffect(() => { setFreeSeen(!!ls.get(".freeWelcome")); }, []);
  const [promoHidden, setPromoHidden] = useState(true);
  useEffect(() => { setPromoHidden(!!ls.get(".promoQ199")); }, []);
  const poll = useRef(null);
  const saveT = useRef(null);
  const skipSave = useRef(true);
  const productsRef = useRef({});

  productsRef.current = products;
  const say = (t) => { setToast(t); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 3000); };
  const member = me && me.member;
  const active = member && member.status === "active";
  const pro = active && member.plan === "pro";
  const [catalogMode, setCatalogMode] = useState(false); // showing the shared catalog (no own data yet)
  const [locked, setLocked] = useState({}); // Free with locked tops: { category: [{ rank, image, score, max, why }] } for ranks 1–5
  const [oneCat, setOneCat] = useState(null); // Free V2: { dayCat, cats: [{ name, count }] } — one category a day
  const shared = !pro || catalogMode;

  // ---- who am I ----
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("login")) { say(q.get("login") === "cancelled" ? "ยกเลิกการเข้าสู่ระบบ" : "เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้ง"); history.replaceState(null, "", "/"); }
    setSignedHint(signedIn || ls.get(".in") === "1");
    skipSave.current = true;
    setProducts(loadLocal().products || {});
    (async () => {
      let r = await api("/api/me");
      // a signed-in user hitting a server/network blip must not be shown the landing page
      for (let i = 0; r.error && signedIn && i < 2; i++) { await new Promise((ok) => setTimeout(ok, 800 * (i + 1))); r = await api("/api/me"); }
      if (r.error && signedIn) return setMe({ member: null, offline: true });
      const base = r.error ? { member: null, left: 0, seats: 10, loginReady: false } : r;
      // Opened inside the LINE app (rich menu / LIFF link): sign in automatically, no button needed.
      if (!base.member && inLine() && ls.get(".lineOut") !== "1") {
        setMe({ ...base, liffSigningIn: true });
        try {
          await loadScript("https://static.line-scdn.net/liff/edge/2/sdk.js");
          await window.liff.init({ liffId: LIFF_ID });
          if (!window.liff.isLoggedIn()) { window.liff.login({ redirectUri: location.href }); return; }
          const res = await api("/api/auth/liff", "POST", { idToken: window.liff.getIDToken() });
          if (!res.error) { const again = await api("/api/me"); if (!again.error) return setMe(again); }
        } catch {}
      }
      setMe(base);
    })();
  }, []);
  useEffect(() => { if (active) (pro ? pullState() : pullCatalog()); }, [active, pro]);
  // Free: what the catalog shows depends on the Bangkok day (one category a day, AI quota, Paywall switch at midnight).
  // A page left open across midnight keeps yesterday's data, so reload it when the day changes.
  const catDay = useRef("");
  const pullRef = useRef(null);
  useEffect(() => {
    if (!active || pro) return;
    const check = () => { if (document.visibilityState === "visible" && catDay.current && catDay.current !== bkkToday()) pullRef.current?.(); };
    const t = setInterval(check, 60e3);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [active, pro]);

  // Free: browse the shared catalog (rules in lib/access.js), nothing to save.
  // Free V2: `pick` chooses today's one category.
  async function pullCatalog(pick) {
    catDay.current = bkkToday();
    const r = await api("/api/catalog" + (pick ? "?cat=" + encodeURIComponent(pick) : ""));
    skipSave.current = true;
    setCatalogMode(true);
    setLocked(r.locked || {});
    setProducts(r.products || {});
    setOneCat(r.oneCat ? { dayCat: r.dayCat || "", cats: r.cats || [] } : null);
    if (r.msg) say(r.msg);
    if (r.oneCat && r.dayCat) setCat((c) => (c === HOT ? c : r.dayCat));
    setReady(true);
  }
  pullRef.current = () => { setOpen(null); pullCatalog(); };
  // Free V2 category chip: the first pick is today's category, others wait until tomorrow (or Pro).
  function pickDayCat(c) {
    if (oneCat.dayCat === c) return pickCat(c);
    if (oneCat.dayCat) return say(`วันนี้คุณเลือกหมวด "${oneCat.dayCat}" แล้ว แพ็ก Free ดูได้วันละ 1 หมวด พรุ่งนี้เลือกใหม่ได้ หรืออัปเกรด Pro ดูทุกหมวด`);
    if (!confirm(`เลือก "${c}" เป็นหมวดของวันนี้?\nแพ็ก Free ดูได้วันละ 1 หมวด เลือกแล้วเปลี่ยนได้พรุ่งนี้`)) return;
    pullCatalog(c);
  }

  // ---- load: server copy if newer, else upload what this device has ----
  async function pullState() {
    const local = loadLocal();
    const hasLocal = local.products && Object.keys(local.products).length > 0;
    const remote = await api("/api/state");
    if (remote.error) { setSync("ออฟไลน์"); setReady(true); return; }
    if (remote.account) setLinked(remote.account);
    if (remote.shopeeSeenAt) setRemoteLive({ live: !!remote.shopeeLive, at: remote.shopeeSeenAt });
    const hasRemote = remote.products && Object.keys(remote.products).length > 0;
    // Pro without own data yet (no Connector / Shopee): show the shared catalog until the first scan
    if (!hasRemote && !hasLocal) return pullCatalog();
    if ((remote.updatedAt || 0) > (local.savedAt || 0) || !hasLocal) {
      skipSave.current = true;
      setProducts(remote.products || {});
      ls.set("", JSON.stringify({ products: remote.products || {}, savedAt: remote.updatedAt || 0 }));
    } else {
      const r = await api("/api/state", "PUT", { products: local.products });
      if (!r.error) ls.set("", JSON.stringify({ products: local.products, savedAt: r.updatedAt }));
    }
    setReady(true);
  }

  // ---- save: local now, server after a short pause ----
  useEffect(() => {
    if (!ready || !active || !pro || catalogMode) return;
    if (skipSave.current) { skipSave.current = false; return; }
    ls.set("", JSON.stringify({ products, savedAt: Date.now() }));
    clearTimeout(saveT.current);
    setSync("กำลังบันทึก…");
    saveT.current = setTimeout(async () => {
      const r = await api("/api/state", "PUT", { products });
      if (r.error) return setSync("บันทึกขึ้น server ไม่ได้");
      ls.set("", JSON.stringify({ products, savedAt: r.updatedAt }));
      setSync("บันทึกแล้ว");
    }, 1200);
  }, [products, ready]);

  // ---- Connector / Shopee session ----
  const isOut = () => ls.get(".out") === "1";
  async function checkStatus() {
    const p = await ext({ type: "ping" }, 3000);
    setExtOk(!p.error);
    if (p.error) return false;
    if (isOut()) { setAccount(null); return false; }
    const s = await ext({ type: "status" });
    setAccount(s.loggedIn ? s : null);
    if (s.loggedIn) setLinked(s.name);
    // tell the server so the phone shows the same status (on change, or every 10 min)
    const real = s.loggedIn || (!s.error || s.error === "not_logged_in");
    const key = (s.loggedIn ? "1:" + s.name : "0");
    const last = ls.get(".shopeeReport") || "";
    if (real && (last.split("|")[0] !== key || Date.now() - Number(last.split("|")[1] || 0) > 6e5)) {
      ls.set(".shopeeReport", key + "|" + Date.now());
      api("/api/state", "PUT", s.loggedIn ? { account: s.name, live: true } : { live: false });
    }
    return !!s.loggedIn;
  }
  useEffect(() => { if (active) checkStatus(); }, [active]);
  useEffect(() => {
    if (!active) return;
    const onVis = () => { if (document.visibilityState === "visible" && extOk) checkStatus(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, extOk]);
  useEffect(() => () => { clearInterval(poll.current); clearTimeout(saveT.current); }, []);

  async function connectShopee() {
    ls.set(".out", null);
    await ext({ type: "openLogin" });
    clearInterval(poll.current);
    let n = 0;
    poll.current = setInterval(async () => {
      n++;
      const ok = await checkStatus();
      if (ok || n > 100) { clearInterval(poll.current); if (ok) say("เชื่อม Shopee Affiliate แล้ว"); }
    }, 3000);
  }

  async function logout(clearLocal) {
    clearInterval(poll.current);
    setConfirmOut(false);
    await api("/api/auth/logout", "POST");
    ls.set(".out", "1"); ls.set(".lineOut", "1");
    if (clearLocal) ls.set("", null);
    skipSave.current = true;
    setAccount(null); setLinked(null); setProducts({}); setReady(false); setOpen(null); setCat("");
    setMe((m) => ({ ...m, member: null }));
    api("/api/me").then((r) => !r.error && setMe(r));
    say("ออกจากระบบแล้ว");
  }

  // ---- data ----
  async function pull(keywords, category, { silent = false } = {}) {
    if (!account) { if (!silent) say("เชื่อม Shopee Affiliate ก่อน"); return; }
    const tag = category || keywords[0];
    if (!silent) setBusy("กำลังดึงสินค้า…"); else setSync(`กำลังอัปเดต “${tag}”…`);
    const next = catalogMode ? {} : { ...productsRef.current }; // first own scan replaces the shared catalog
    let added = 0;
    for (const k of keywords) {
      for (const offset of [0, 20]) {
        const r = await ext({ type: "search", opts: { keyword: k, offset, limit: 20, sortType: 2 } });
        if (r.error) { setBusy(""); if (r.error === "not_logged_in") setAccount(null); if (!silent) say("ดึงไม่สำเร็จ: " + (r.error === "not_logged_in" ? "ยังไม่ได้ล็อกอิน Shopee Affiliate" : r.error)); return; }
        for (const it of r.items) {
          const old = next[it.id];
          const { longLink, ...rest } = it;
          next[it.id] = { ...old, ...rest, category: tag, keyword: k, fetchedAt: Date.now() };
          if (!old) added++;
        }
      }
    }
    // links for the Top 20 of this category now, so they still work after Shopee logout / on the phone
    const top = rank(Object.values(next).filter((p) => p.category === tag)).slice(0, 20).filter((p) => !p.affLink);
    if (top.length) {
      if (!silent) setBusy("กำลังสร้างลิงก์ Top 20…");
      const r = await ext({ type: "links", items: top.map((p) => ({ itemId: p.itemId, shopId: p.shopId })), subIds: ["pukpak"] });
      for (const l of r.links || []) {
        const id = l.shopId + "_" + l.itemId;
        if (next[id] && l.link) next[id] = { ...next[id], affLink: l.link, linkAt: Date.now() };
      }
    }
    setCatalogMode(false); setProducts(next); setBusy("");
    if (silent) { setSync(`อัปเดต “${tag}” แล้ว`); return; }
    setCat(tag); setKw("");
    say(`ได้สินค้าใหม่ ${added} ตัว ในหมวด “${tag}” พร้อมลิงก์ Top 20`);
    setTimeout(() => document.getElementById("cats")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  const keywordsFor = (c) => (PRESETS.find(([n]) => n === c) || [null, [...new Set(Object.values(productsRef.current).filter((p) => p.category === c).map((p) => p.keyword || c))]])[1];

  const patch = (id, data) => setProducts((prev) => ({ ...prev, [id]: { ...prev[id], ...data } }));

  async function scoreOne(p, refresh = false) {
    setAiBusy(p.id);
    const r = await api("/api/score", "POST", { item: { id: p.id, name: p.name, price: effPrice(p), category: p.category }, refresh });
    setAiBusy(null);
    if (r.error) return say(r.error);
    patch(p.id, { ai: { ...r.score, cached: r.cached } });
    if (!pro) api("/api/me").then((x) => !x.error && x.member && setMe(x));
    say(r.cached ? (pro ? "ได้คะแนนจากคลัง ไม่เสียโควต้า AI" : "ได้ไอเดียจาก AI แล้ว · ตะกร้านี้กดดูซ้ำได้ทั้งวัน") : "AI ให้คะแนนแล้ว");
  }

  // Pro: load this product's personal ideas when its detail opens (once per product per session).
  useEffect(() => {
    if (!pro || !open || ideas[open]) return;
    api(`/api/ideas?id=${encodeURIComponent(open)}`).then((r) => !r.error && setIdeas((x) => ({ ...x, [open]: r })));
  }, [open, pro]);
  async function moreIdea(p) {
    if (!pro) return say("ขอไอเดียส่วนตัวเพิ่มอีก 4 แบบต่อตะกร้า ได้เฉพาะ Pro — คนอื่นจะไม่ได้ hook ซ้ำกับคุณ");
    setIdeaBusy(p.id);
    const r = await api("/api/ideas", "POST", { item: { id: p.id, name: p.name, price: effPrice(p), category: p.category } });
    setIdeaBusy(null);
    if (r.list) setIdeas((x) => ({ ...x, [p.id]: { list: r.list, left: r.left ?? 0 } }));
    say(r.error || "ได้ไอเดียใหม่แล้ว เป็นของคุณคนเดียว");
  }

  async function makeLink(p) {
    const subId = p.subId || String(p.itemId).slice(-8);
    const r = await ext({ type: "links", items: [{ itemId: p.itemId, shopId: p.shopId }], subIds: ["pukpak", subId] });
    if (r.error || !r.links?.[0]) return say("สร้างลิงก์ไม่สำเร็จ: " + (r.error || "ไม่มีลิงก์"));
    patch(p.id, { affLink: r.links[0].link, subId });
    try { await navigator.clipboard.writeText(r.links[0].link); say("สร้างและคัดลอกลิงก์แล้ว"); } catch { say("สร้างลิงก์แล้ว"); }
  }
  async function copyLink(p) {
    try { await navigator.clipboard.writeText(p.affLink); say("คัดลอกลิงก์แล้ว"); } catch { say(p.affLink); }
  }

  const all = Object.values(products);
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];
  // rank each category once per data change; switching category then only picks a cached list
  const rankedBy = useMemo(() => {
    const m = { "": rank(all) };
    for (const c of new Set(all.map((p) => p.category).filter(Boolean))) m[c] = byRank(rank(all.filter((p) => p.category === c)));
    return m;
  }, [products]);
  const ranked = rankedBy[cat] || rankedBy[""];
  const catShown = useDeferredValue(cat);
  const rankedShown = rankedBy[catShown] || rankedBy[""];
  const act = useRef({});
  act.current = { moreIdea, scoreOne, copyLink, makeLink, usedAppLink, say };
  // all categories: one teaser row per category's #1; a category: its locked 1–5
  const lockedRows = shared ? (cat ? locked[cat] || [] : Object.entries(locked).map(([c, r]) => r[0] && { ...r[0], category: c }).filter(Boolean)) : [];
  const [limit, setLimit] = useState(20);
  const [, startTransition] = useTransition();
  const newestBy = useMemo(() => all.reduce((m, p) => ((m[p.category] = Math.max(m[p.category] || 0, p.fetchedAt || 0)), m), {}), [products]);
  const refreshed = useRef(false);
  useEffect(() => {
    if (!pro || !account || !ready || refreshed.current) return;
    refreshed.current = true;
    const stale = Object.entries(newestBy).filter(([c, t]) => c && t && Date.now() - t > STALE_MS).sort((a, b) => a[1] - b[1]).slice(0, 2);
    (async () => { for (const [c] of stale) await pull(keywordsFor(c), c, { silent: true }); })();
  }, [account, ready]);
  // "🔥 มาแรง": cross-category products selling faster than their own usual pace (/api/trending).
  // Opens as the first view when there is something to show.
  const [hot, setHot] = useState(null);
  useEffect(() => {
    if (!active || !ready || hot) return;
    api("/api/trending").then((r) => {
      setHot(r && r.items ? r : { items: [], more: 0 });
      if (r?.items?.length) setCat((c) => c || HOT);
    });
  }, [active, ready]);
  const pickCat = (c) => { setOpen(null); setLimit(20); setCat(c); };
  const viewOnly = active && !account && extOk === false;
  const [editCats, setEditCats] = useState(false);
  const [delCat, setDelCat] = useState(null);
  const countBy = useMemo(() => all.reduce((m, p) => ((m[p.category] = (m[p.category] || 0) + 1), m), {}), [products]);
  const linkCount = (c) => all.filter((p) => p.category === c && p.affLink).length;
  function removeCat(c) {
    setProducts((prev) => Object.fromEntries(Object.entries(prev).filter(([, p]) => p.category !== c)));
    if (cat === c) setCat("");
    setDelCat(null);
    if (cats.length <= 1) setEditCats(false);
    say(`ลบหมวด “${c}” แล้ว`);
  }

  // ---- onboarding: mobile-first. 3 simple steps for everyone; PC scanning is "ขั้นสูง" (opt-in) ----
  const [obHidden, setObHidden] = useState(false);
  const [nudge, setNudge] = useState(null); // "links" | "cats"
  useEffect(() => { setObHidden(ls.get(".obHide2") === "1"); }, []);
  const serverDone = (member && member.onboarding && member.onboarding.done) || [];
  const advanced = !!(extOk || account || !catalogMode && all.length);
  const obDone = [...new Set([
    ...serverDone,
    "line",
    ...(member?.botSeenAt ? ["bot"] : []),
    ...(advanced && all.some((p) => p.affLink) ? ["applink"] : []),
    // advanced progress (shown to the admin)
    ...(extOk || account || linked ? ["connector"] : []),
    ...(account || linked ? ["shopee"] : []),
    ...(!catalogMode && all.length ? ["scan"] : []),
    ...(all.some((p) => p.ai) ? ["ai"] : []),
  ])];
  const CORE = ["line", "bot", "applink"];
  const coreDone = CORE.filter((k) => obDone.includes(k));
  const obKey = obDone.slice().sort().join(",");
  useEffect(() => {
    if (!active || obKey === serverDone.slice().sort().join(",")) return;
    api("/api/me", "POST", { done: obDone });
  }, [obKey, active]);
  const showOnboarding = active && !obHidden && coreDone.length < CORE.length;
  const obNext = CORE.find((k) => !obDone.includes(k));
  function startScan() {
    const el = document.getElementById("scan");
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }
    say("เลือกหมวดที่คุณทำคลิป หรือพิมพ์คำค้นเอง");
  }
  function openTop() {
    const top = ranked[0];
    if (!top) return;
    setOpen(top.id);
    setTimeout(() => document.getElementById("row-" + top.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    say("กด “เอาลิงก์ของฉัน” แล้วใส่ Affiliate ID ของคุณ");
  }
  // user got a link the simple way (open in Shopee app / copy product link)
  function usedAppLink() {
    if (!serverDone.includes("applink")) api("/api/me", "POST", { done: [...obDone, "applink"] }).then(() => setMe((x) => x && x.member ? { ...x, member: { ...x.member, onboarding: { done: [...obDone, "applink"] } } } : x));
    const n = Number(ls.get(".appOpens") || 0) + 1;
    ls.set(".appOpens", String(n));
    if (n >= 5 && !advanced && ls.get(".nudgeLinks") !== "1") { ls.set(".nudgeLinks", "1"); setNudge("links"); }
  }

  useEffect(() => { if (me) ls.set(".in", me.member ? "1" : null); }, [me]);
  if (me && me.offline) return (
    <div className="wrap"><section className="panel">
      <p className="hint" style={{ margin: 0 }}>เชื่อมต่อ server ไม่ได้ชั่วคราว</p>
      <button className="btn primary" style={{ marginTop: 12 }} onClick={() => location.reload()}>ลองใหม่</button>
    </section></div>
  );
  if ((me && !member && !me.liffSigningIn) || (!me && !signedHint)) return <Landing me={me} onLogin={() => ls.set(".lineOut", null)} />;
  if (!me) return <div className="wrap" aria-busy="true" />;

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <img src="/logo.svg" alt="" width="44" height="44" />
          <div>
          <h1>ปั๊กปัก</h1>
          <p className="sub">ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</p>
          </div>
        </div>
        {member && (
          <div className="bar">
            {member.picture && <img className="avatar" src={member.picture} alt="" referrerPolicy="no-referrer" />}
            <span className="who">{member.name}</span>
            {active && <PlanBadge member={member} />}
            <a className="btn" href="/settings">บัญชีของฉัน</a>
            {pro && advanced && <span className={"src" + (account || (extOk === false && remoteLive?.live) ? " ok" : "")} title={extOk === false && remoteLive ? "สถานะจากคอม · " + ago(remoteLive.at) : undefined}><i />{account ? `Shopee: ${account.name}` : linked ? `Shopee: ${linked}` : "ยังไม่เชื่อม Shopee"}</span>}
            {sync && <span className="hint">{sync}</span>}
            {member.admin && <a className="btn" href="/admin">จัดการสมาชิก</a>}
            {!confirmOut && <button className="btn" onClick={() => setConfirmOut(true)}>ออกจากระบบ</button>}
          </div>
        )}
      </header>

      {confirmOut && (
        <section className="panel">
          <h2>ออกจากระบบปั๊กปัก</h2>
          <p className="hint">ข้อมูลของคุณเก็บไว้ในบัญชี เข้าสู่ระบบด้วย LINE อีกครั้งเมื่อไหร่ก็กลับมาครบ การออกจากระบบนี้ไม่ได้ออกจาก Shopee Affiliate</p>
          <div className="bar">
            <button className="btn primary" onClick={() => logout(true)}>ออกจากระบบ</button>
            <button className="btn" onClick={() => setConfirmOut(false)}>ยกเลิก</button>
          </div>
        </section>
      )}

      {me && !member && me.liffSigningIn && <section className="panel"><p className="hint" style={{ margin: 0 }}>กำลังเข้าสู่ระบบด้วย LINE…</p></section>}
      {me && !member && !me.liffSigningIn && (
        <section className="panel hero-panel">
          <span className="eyebrow">Early Access</span>
          <h2 className="big">เลือกตะกร้าที่ทำคลิปแล้วขายได้ ก่อนเสียเวลาถ่าย</h2>
          <p className="hint">ปั๊กปักดึงสินค้าจาก Shopee Affiliate ของคุณ ให้คะแนนจากยอดขาย ค่าคอม รีวิว และให้ AI ประเมินว่าทำคลิปง่ายแค่ไหน พร้อม hook 3 วินาทีแรก</p>
          <div className="bar">
            <a className={"btn line" + (me.loginReady ? "" : " disabled")} href={me.loginReady ? "/api/auth/line" : undefined} onClick={() => ls.set(".lineOut", null)}>เข้าสู่ระบบด้วย LINE</a>
            <span className="seats">{me.left > 0 ? <>เหลือ <b className="num">{me.left}</b> จาก {me.seats} ที่</> : "สมัครแล้วใช้ฟรีได้ทันที · ท็อป 5/หมวด · AI 3 ครั้ง/วัน"}</span>
          </div>
          {!me.loginReady && <p className="hint">ระบบเข้าสู่ระบบยังตั้งค่าไม่เสร็จ</p>}
        </section>
      )}

      {member && member.status === "active" && member.plan !== "pro" && member.freeSince && !freeSeen && (
        <section className="panel hero-panel">
          <span className="eyebrow">Free</span>
          <h2>เปิดให้ใช้ฟรีแล้ว ไม่ต้องรอคิว 🎉</h2>
          <ul className="hint" style={{ margin: "6px 0 10px", paddingLeft: 18 }}>
            <li>ท็อป 5 ตะกร้า/หมวด จากยอดขายจริง</li>
            <li>ให้ AI คิด hook คลิป 3 ครั้ง/วัน</li>
            <li>เอาลิงก์ของตัวเองผ่านแอป Shopee</li>
          </ul>
          <div className="bar">
            <button className="btn primary" onClick={() => { ls.set(".freeWelcome", "1"); setFreeSeen(true); }}>เริ่มใช้เลย</button>
            <span className="hint">อยากเห็นทุกตัว + AI 30 ครั้ง/วัน → Pro ฿{me.price?.month || 199}/เดือน</span>
          </div>
        </section>
      )}
      {me.webPromo && !promoHidden && <PromoBanner promo={me.webPromo} onClose={() => { ls.set(".promoQ199", "1"); setPromoHidden(true); }} />}
      {member && member.status === "revoked" && (
        <section className="panel"><h2>บัญชีนี้ถูกระงับการใช้งาน</h2><p className="hint">ติดต่อผู้ดูแลปั๊กปักหากคิดว่าเป็นความผิดพลาด</p></section>
      )}

      {showOnboarding && (
        <section className="panel onboard">
          <div className="bar" style={{ justifyContent: "space-between" }}>
            <h2>เริ่มใช้บนมือถือ <span className="num hint">{coreDone.length}/{CORE.length}</span></h2>
            <button className="btn ghost" onClick={() => { ls.set(".obHide2", "1"); setObHidden(true); }}>ซ่อน</button>
          </div>
          <div className="progress"><i style={{ width: `${(coreDone.length / CORE.length) * 100}%` }} /></div>
          <ol className="steps-list">
            <Step done title="เข้าสู่ระบบด้วย LINE" />
            <Step done={obDone.includes("bot")} current={obNext === "bot"} title="เพิ่มเพื่อน LINE ปั๊กปัก" hint="ในแชทกด “ท็อป 5 วันนี้” ที่เมนูด้านล่าง ได้ตะกร้าน่าทำคลิปทันที ไม่ต้องเปิดคอม">
              <a className="btn primary" href={OA_ADD} target="_blank" rel="noopener">เพิ่มเพื่อน @979soyth</a>
            </Step>
            <Step done={obDone.includes("applink")} current={obNext === "applink"} title="เอาลิงก์แอฟของคุณเอง 1 ตัว" hint="กด “เอาลิงก์ของฉัน” ใต้สินค้า แล้วใส่ Affiliate ID ของคุณ (ต้องมี Affiliate ID เท่านั้น)">
              <button className="btn primary" disabled={!ranked.length} onClick={openTop}>เปิดสินค้าอันดับ 1</button>
            </Step>
          </ol>
        </section>
      )}

      {nudge && (
        <section className="panel nudge">
          <div>
            <h2>{nudge === "links" ? "เบื่อกดแชร์ทีละตัวไหม?" : "หาหมวดที่ต้องการไม่เจอ?"}</h2>
            <p className="hint">{nudge === "links" ? "เปิด “ลิงก์อัตโนมัติ” แล้วระบบสร้างลิงก์ของคุณให้ Top 20 ทุกหมวด ก๊อปจากแชท LINE ได้ทันที" : "สแกนหมวดหรือคำค้นที่คุณทำเองได้ในขั้นสูง ระบบจัดอันดับและสร้างลิงก์ให้"}</p>
          </div>
          <div className="bar">
            {pro ? <a className="btn primary" href="/settings#advanced">ดูวิธีเปิดขั้นสูง</a> : <a className="btn primary" href={UPGRADE_URL} target="_blank" rel="noopener">อัปเกรด Pro</a>}
            <button className="btn ghost" onClick={() => setNudge(null)}>ไว้ทีหลัง</button>
          </div>
        </section>
      )}

      {pro && extOk && !account && (
        <section className="panel">
          {linked && <p className="hint" style={{ margin: 0 }}>หลุดจาก Shopee Affiliate อยู่ ข้อมูลและลิงก์เดิมยังใช้ได้ครบ ล็อกอินอีกครั้งเพื่อสแกนหรือสร้างลิงก์ใหม่</p>}
          <h2>ขั้นสูง: เชื่อม Shopee Affiliate</h2>
          <p className="hint">ติดตั้ง Connector แล้ว เหลือล็อกอิน Shopee Affiliate ในแท็บที่เปิดให้ ระบบจะรู้เองเมื่อล็อกอินเสร็จ</p>
          <div className="bar"><button className="btn primary" onClick={connectShopee}>เชื่อม Shopee Affiliate ↗</button></div>
        </section>
      )}
      {active && !pro && <Upgrade offer={me.offer} paywall={me.paywall} lim={member.limits || {}} />}
      {pro && viewOnly && !catalogMode && (
        <section className="panel">
          <p className="hint" style={{ margin: 0 }}>เครื่องนี้ดูคะแนนและก๊อปลิงก์ได้ ส่วนการสแกนใหม่และสร้างลิงก์ ใช้คอมที่ติดตั้ง <a href="/connector" target="_blank" rel="noopener">ปั๊กปัก Connector</a> (ขั้นสูง)</p>
          <ShopeeOffInfo />
        </section>
      )}

      {active && <>
      {account && pro && (
        <section className="panel" id="scan">
          <h2>ดึงสินค้าจาก Shopee Affiliate</h2>
          <div className="bar">
            {PRESETS.map(([c, kws]) => <button key={c} className="chip" disabled={!!busy} onClick={() => pull(kws, c)}>{c}</button>)}
          </div>
          <form className="bar" onSubmit={(e) => { e.preventDefault(); kw.trim() && pull([kw.trim()], ""); }}>
            <input className="grow" id="kw" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="หรือพิมพ์คำค้น เช่น แปรงขัดห้องน้ำ" />
            <button className="btn" disabled={!!busy}>ดึงสินค้า</button>
          </form>
          <p className="hint" style={{ margin: 0 }}>สแกนแต่ละหมวด ระบบสร้างลิงก์ให้ Top 20 ทันที ออกจาก Shopee หรือปิดคอมแล้วก็ยังก๊อปลิงก์ได้</p>
          <ShopeeOffInfo />
        </section>
      )}

      {(
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="bar" id="cats">
            {(hot?.items?.length > 0 || hot?.locked?.length > 0) && <button className={"chip hot" + (cat === HOT ? " on" : "")} onClick={() => pickCat(HOT)}>🔥 มาแรง</button>}
            <button className={"chip" + (!cat ? " on" : "")} onClick={() => pickCat("")}>ทุกหมวด <span className="num">{all.length}</span></button>
            {oneCat ? oneCat.cats.map(({ name: c, count }) => (
              <button key={c} className={"chip" + (cat === c ? " on" : "") + (oneCat.dayCat && oneCat.dayCat !== c ? " off" : "")} onClick={() => pickDayCat(c)}>{oneCat.dayCat && oneCat.dayCat !== c ? "🔒 " : ""}{c} <span className="num">{count}</span></button>
            )) : cats.map((c) => (
              <span key={c} className={"chip-wrap" + (editCats ? " editing" : "")}>
                <button className={"chip" + (cat === c ? " on" : "")} onClick={() => (editCats ? setDelCat(c) : pickCat(c))}>{c} <span className="num">{countBy[c]}</span>{editCats && <span className="chip-x" aria-label={"ลบหมวด " + c}>×</span>}</button>
              </span>
            ))}
            {!advanced && cats.length > 0 && <button className="btn ghost" onClick={() => setNudge("cats")}>หาหมวดไม่เจอ?</button>}
            {pro && !catalogMode && cats.length > 0 && <button className="btn ghost" onClick={() => { setEditCats(!editCats); setDelCat(null); }}>{editCats ? "เสร็จ" : "จัดการหมวด"}</button>}
          </div>
          {cat && newestBy[cat] > 0 && (
            <p className={"hint fresh" + (Date.now() - newestBy[cat] > STALE_MS ? " stale" : "")} style={{ margin: 0 }}>
              ข้อมูลหมวดนี้อัปเดต{ago(newestBy[cat])}{Date.now() - newestBy[cat] > STALE_MS && " · ค่าคอมและราคาอาจเปลี่ยนแล้ว"}
              {account && Date.now() - newestBy[cat] > DAY && <button className="btn ghost" onClick={() => pull(keywordsFor(cat), cat)} disabled={!!busy}>อัปเดตตอนนี้</button>}
            </p>
          )}
          {delCat && (
            <div className="confirm">
              <span>ลบหมวด “{delCat}” และสินค้า {countBy[delCat]} ตัวในหมวดนี้?{linkCount(delCat) > 0 && ` (มีลิงก์ affiliate ที่สร้างไว้ ${linkCount(delCat)} ลิงก์จะหายด้วย)`}</span>
              <div className="bar">
                <button className="btn danger" onClick={() => removeCat(delCat)}>ลบหมวด</button>
                <button className="btn" onClick={() => setDelCat(null)}>ยกเลิก</button>
              </div>
            </div>
          )}
          {busy && <p className="hint">{busy}</p>}
          {cat === HOT ? <HotList hot={hot} open={open} setOpen={setOpen} shared={shared} usedAppLink={usedAppLink} say={say} /> : <>
          <details className="explain">
            <summary>คะแนนคิดยังไง?</summary>
            <div className="explain-body">
              <p><b>คะแนนรวม 100</b> = data 60 + AI 40 · แถบสีส้มคือ Top 10</p>
              <p><b>data (คำนวณจากตัวเลขจริง ไม่เสียค่า AI)</b> ยอดขาย 20 · ค่าคอม 15 · rating + รีวิว 10 · ราคาซื้อง่าย ฿99–599 อีก 10 · ร้าน Mall/Preferred 5</p>
              <p><b>AI (กดให้คะแนนทีละตัว)</b> โชว์ปัญหา→ทางแก้ได้ใน 3 วิ 15 · มีภาพหยุดนิ้ว 15 · เล่าได้หลายมุม 10</p>
              <p><b>≈ ฿/ชิ้น</b> = ราคา × % ค่าคอม คือค่าคอมโดยประมาณต่อ 1 order</p>
            </div>
          </details>
          {lockedRows.length > 0 && <LockedTop rows={lockedRows} cat={cat} />}
          <div className="list">
            {!ranked.length && oneCat && !oneCat.dayCat && <div className="empty"><strong>เลือก 1 หมวดของวันนี้</strong><span>แพ็ก Free ดูได้วันละ 1 หมวด กดชื่อหมวดด้านบนได้เลย</span></div>}
            {!ranked.length && !(oneCat && !oneCat.dayCat) && <div className="empty"><strong>ยังไม่มีสินค้า</strong><span>{ready ? (account ? "กดเลือกหมวดด้านบนเพื่อดึงสินค้า" : "เชื่อม Shopee Affiliate บนคอมเพื่อดึงสินค้า") : "กำลังโหลด…"}</span></div>}
            <ProductList ranked={rankedShown} limit={limit} open={open} setOpen={setOpen} cat={catShown} ideas={ideas} ideaBusy={ideaBusy} aiBusy={aiBusy} pro={pro} catalogMode={catalogMode} account={account} shared={shared} act={act} />
          </div>
          {ranked.length > limit && <button className="btn" style={{ alignSelf: "center" }} onClick={() => setLimit(limit + 40)}>แสดงเพิ่มอีก {Math.min(40, ranked.length - limit)} ตัว (จาก {ranked.length})</button>}
          </>}
        </section>
      )}
      </>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// Product rows are memoized: switching category renders the old list instantly (deferred value)
// and the new one in the background; opening a row only re-renders that row.
const ProductList = memo(function ProductList({ ranked, limit, open, ideas, ideaBusy, aiBusy, ...rest }) {
  return ranked.slice(0, limit).map((p, i) => (
    <ProductRow key={p.id} p={p} i={i} isOpen={open === p.id} idea={ideas[p.id]} ideaBusy={ideaBusy === p.id} aiBusy={aiBusy === p.id} {...rest} />
  ));
});

const ProductRow = memo(function ProductRow({ p, i, isOpen, idea, ideaBusy, aiBusy, setOpen, cat, pro, catalogMode, account, shared, act }) {
  return (
    <div id={"row-" + p.id} className={"row" + (i < 10 ? " top10" : "")} onClick={(e) => { if (!e.target.closest(".detail")) setOpen((o) => (o === p.id ? null : p.id)); }}>
                <div className="rank">{p._rank || i + 1}</div>
                {p.image ? <img className="thumb" src={img(p.image)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="thumb" />}
                <div style={{ minWidth: 0 }}>
                  <div className="name">{p.name}</div>
                  <div className="meta">
                    <span>฿<span className="num">{fmt(effPrice(p))}</span></span>
                    <span>ขาย <span className="num">{fmt(p.sold)}</span></span>
                    <span>คอม <span className="num">{fmt(p.commission)}%</span> ≈ ฿<span className="num">{fmt(p._perOrder)}</span>/ชิ้น</span>
                    <span>★ <span className="num">{fmt(p.rating)}</span></span>
                    {p.affLink && <span className="tag a">มีลิงก์</span>}
                    {p.fetchedAt && Date.now() - p.fetchedAt > STALE_MS && <span className="tag b">ข้อมูล{ago(p.fetchedAt)}</span>}
                    {p.shop && <span className="tag">{p.shop}</span>}
                    {!cat && p._rank && <span className="tag">{p.category}</span>}
                  </div>
                </div>
                <div className="scores">
                  <div className="sline"><span>data</span><div className="track"><div className="fill" style={{ width: `${(p._d.total / p._d.max) * 100}%` }} /></div><span className="num">{Math.round(p._d.total)}</span></div>
                  <div className="sline"><span>AI</span><div className="track"><div className="fill ai" style={{ width: `${p._a ? (p._a.total / p._a.max) * 100 : 0}%` }} /></div><span className="num">{p._a ? Math.round(p._a.total) : "–"}</span></div>
                </div>
                <div className="total">{Math.round(p._t)}</div>
                {isOpen && (
                  <div className="detail">
                    {p.image && <a href={p.url || img(p.image, "")} target="_blank" rel="noopener"><img className="hero" src={img(p.image, "")} alt={p.name} loading="lazy" referrerPolicy="no-referrer" /></a>}
                    {p.ai ? <>
                      <div className="hook">“{p.ai.hook}”</div>
                      {p.ai.angles?.length > 0 && <ol className="angles">{p.ai.angles.map((a, k) => <li key={k}>{a}</li>)}</ol>}
                      <div className="why">{p.ai.why}</div>
                      <div className="hint">{p.ai.cached ? "คะแนนจากคลังของปั๊กปัก" : "AI ให้คะแนนแล้ว"}</div>
                      {(idea?.list || []).map((x, k) => (
                        <div key={k} className="panel" style={{ margin: "10px 0 0", padding: 12 }}>
                          <div className="hint">✨ ไอเดียส่วนตัว #{k + 2} · คนอื่นไม่เห็น</div>
                          <div className="hook">“{x.hook}”</div>
                          {x.angles?.length > 0 && <ol className="angles">{x.angles.map((a, j) => <li key={j}>{a}</li>)}</ol>}
                          {x.why && <div className="why">{x.why}</div>}
                        </div>
                      ))}
                      {(!pro || (idea?.left ?? 1) > 0) && <div className="bar" style={{ marginTop: 8 }}>
                        <button className="btn" disabled={ideaBusy} onClick={() => act.current.moreIdea(p)}>{ideaBusy ? "AI กำลังคิด…" : pro ? `🔄 ขอไอเดียใหม่ (เหลือ ${idea?.left ?? 4})` : "🔒 ขอไอเดียใหม่ · Pro"}</button>
                        <span className="hint">{pro ? "ไอเดียส่วนตัว ไม่ซ้ำกับที่คนอื่นได้" : "Pro ได้อีก 4 แบบต่อตะกร้า ไม่ซ้ำกับคนอื่น"}</span>
                      </div>}
                    </> : <div className="bar">
                      <button className="btn primary" disabled={aiBusy} onClick={() => act.current.scoreOne(p)}>{aiBusy ? "AI กำลังให้คะแนน…" : "ให้ AI ให้คะแนนตัวนี้"}</button>
                      <span className="hint">ถ้ามีคนให้คะแนนสินค้านี้แล้ว จะได้คะแนนทันทีโดยไม่เสียค่า AI</span>
                    </div>}
                    {p.affLink && <div className="linkbox">{p.affLink} · Sub ID: pukpak{p.subId ? " / " + p.subId : ""}</div>}
                    <div className="bar">
                      {p.affLink && <button className="btn primary" onClick={() => act.current.copyLink(p)}>คัดลอกลิงก์</button>}
                      {pro && !catalogMode && account && !p.affLink && <button className="btn primary" onClick={() => act.current.makeLink(p)}>สร้างลิงก์ affiliate</button>}
                      {shared && !p.affLink && p.url && <AffLinkBox key={p.id} url={p.url} onDone={(...a) => act.current.usedAppLink(...a)} say={(...a) => act.current.say(...a)} />}
                      {p.url && <a className="btn" href={p.url} target="_blank" rel="noopener">หน้าสินค้า ↗</a>}
                    </div>
                  </div>
                )}
              </div>
  );
});

// Stored rank (6–10 while top 5 is locked) wins over re-ranking a partial list.
const HOT = "__hot";

// "🔥 มาแรง": cross-category list from /api/trending (Free: 3, Pro: 20).
function HotList({ hot, open, setOpen, shared, usedAppLink, say }) {
  const items = hot?.items || [];
  return (
    <>
      <p className="hint" style={{ margin: 0 }}>ตะกร้าจากทุกหมวดที่ขายเร็วกว่าปกติของตัวเอง{hot?.since ? ` · เทียบกับ${ago(hot.since)}` : ""} — ไม่ใช่ยอดขายรวม เลยไม่ซ้ำกับท็อปรายหมวด</p>
      {hot?.locked?.length > 0 && <LockedTop rows={hot.locked} note={`มาแรงอันดับ 1–${hot.locked.length}${items.length ? ` · ด้านล่างคืออันดับ ${hot.locked.length + 1}–${hot.locked.length + items.length}` : ""}`} />}
      <div className="list">
        {items.map((p, i) => (
          <div key={p.id} className="row hot top10" onClick={(e) => { if (!e.target.closest(".detail")) setOpen(open === p.id ? null : p.id); }}>
            <div className="rank">{p.rank || i + 1}</div>
            {p.image ? <img className="thumb" src={img(p.image)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="thumb" />}
            <div style={{ minWidth: 0 }}>
              <div className="name">{p.name}</div>
              <div className="meta">
                <span>฿<span className="num">{fmt(effPrice(p))}</span></span>
                <span>คอม <span className="num">{fmt(p.commission)}%</span> ≈ ฿<span className="num">{fmt(p.perOrder)}</span>/ชิ้น</span>
                {p.category && <span className="tag">{p.category}</span>}
              </div>
            </div>
            <div className="hot-num"><b className="num">~{fmt(p.perDay)}</b><small>ชิ้น/วัน</small>{p.boost >= 1.5 && <small className="up">เร็วขึ้น {fmt(p.boost)} เท่า</small>}</div>
            {open === p.id && (
              <div className="detail">
                <div className="bar">
                  {shared && p.url && <AffLinkBox key={p.id} url={p.url} onDone={usedAppLink} say={say} />}
                  {p.url && <a className="btn" href={p.url} target="_blank" rel="noopener">หน้าสินค้า ↗</a>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {hot?.more > 0 && <a className="btn primary" style={{ alignSelf: "center" }} href={UPGRADE_URL} target="_blank" rel="noopener">ดูอีก {hot.more} ตัวด้วย Pro</a>}
    </>
  );
}

const byRank = (list) => (list.some((p) => p._rank) ? [...list].sort((a, b) => (a._rank || 99) - (b._rank || 99)) : list);

// Lock test: blurred rows for ranks 1–5 with one call to action on top.
function LockedTop({ rows, cat, note }) {
  return (
    <a className="locked" href={UPGRADE_URL} target="_blank" rel="noopener">
      <div className="locked-rows" aria-hidden="true">
        {rows.map((r, i) => (
          <div key={i} className="row top10">
            <div className="rank">{r.rank}</div>
            {r.image ? <img className="thumb" src={img(r.image)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="thumb" />}
            <div style={{ minWidth: 0 }}>
              <div className="name">ตะกร้าอันดับ {r.rank}{r.category ? ` · ${r.category}` : ""} ███████ ████</div>
              <div className="meta">{r.score > 0 && <span>คะแนน <span className="num">{r.score}</span>/{r.max}</span>}{(r.why || []).map((w) => <span key={w} className="tag">{w}</span>)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="locked-cta">
        <span className="locked-ico">🔒</span>
        <b>ปลดล็อคตะกร้า Top 5 สำหรับผู้ใช้งาน Pro เท่านั้น</b>
        <small>{note || `${cat ? `อันดับ 1–${rows.length} ของหมวด ${cat}` : `ท็อป 5 ของทั้ง ${rows.length} หมวด`} · ด้านล่างคืออันดับ 6–10`}</small>
        <span className="btn primary">ปลดล็อคด้วย Pro</span>
      </div>
    </a>
  );
}

// Halloween ฿199 promo, shown only when /api/me returns webPromo (eligible Free members; lib/plan.js webPromoFor).
const PROMO_URL = "https://line.me/R/oaMessage/@979soyth/?" + encodeURIComponent("รับโปร 199");
function PromoBanner({ promo, onClose }) {
  useEffect(() => { if (!ls.get(".promoQ199Seen")) { ls.set(".promoQ199Seen", "1"); api("/api/me", "POST", { webPromo: "seen" }); } }, []);
  return (
    <section className="panel promo-q199">
      <button className="btn ghost promo-x" aria-label="ปิด" onClick={onClose}>✕</button>
      <a href={PROMO_URL} target="_blank" rel="noopener" onClick={() => api("/api/me", "POST", { webPromo: "click" })}>
        <img src="/promo-q199.jpg" alt={`โปรฮาโลวีน ปั๊กปัก Pro ฿${promo.price} ใช้ได้ ${promo.span}`} width="1254" height="1254" />
      </a>
      <div className="bar">
        <a className="btn primary" href={PROMO_URL} target="_blank" rel="noopener" onClick={() => api("/api/me", "POST", { webPromo: "click" })}>รับโปร ฿{promo.price} · {promo.span}</a>
        <span className="hint">กดแล้วระบบเปิดแชท LINE ส่ง QR ให้ทันที · ช่วงเวลาจำกัด</span>
      </div>
    </section>
  );
}
const UPGRADE_URL = "https://line.me/R/oaMessage/@979soyth/?" + encodeURIComponent("อัปเกรด Pro");
const OA_ADD = "https://line.me/R/ti/p/@979soyth";
const thDate = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

function PlanBadge({ member }) {
  if (member.plan === "pro") {
    const soon = member.proUntil && member.proUntil - Date.now() < 7 * 864e5;
    return (
      <span className={"plan pro" + (soon ? " soon" : "")} title={member.proUntil ? `Pro ใช้ได้ถึง ${thDate(member.proUntil)}` : "Pro"}>
        Pro{member.earlyAccess && <em>Early Access</em>}{member.proUntil && <small>ถึง {thDate(member.proUntil)}</small>}
      </span>
    );
  }
  return <a className="plan free" href={UPGRADE_URL} target="_blank" rel="noopener">Free <small>อัปเกรด</small></a>;
}

function Upgrade({ offer, paywall, lim }) {
  const month = offer?.month || 199, year = offer?.year || 1990;
  return (
    <section className="panel upgrade">
      {paywall?.countdown && <p className="countdown">{paywall.countdown}</p>}
      <div>
        <h2>คุณใช้แพ็ก Free อยู่</h2>
        <p className="hint">{lim.oneCat ? `ดูได้วันละ 1 หมวด ${lim.topPerCat} ตะกร้า (ท็อป 1–5 ล็อกไว้สำหรับ Pro) · AI วันละ ${lim.aiPerDay} ตัว · ลิงก์วันละ ${lim.linksPerDay} ลิงก์` : `ดูได้ ${lim.topPerCat || 5} ตะกร้าต่อหมวดจากคลังกลาง · AI วันละ ${lim.aiPerDay || 3} ตัว`} ใช้บนมือถืออย่างเดียวได้ ไม่ต้องยุ่งกับคอม</p>
      </div>
      <div className="howlink">
        <b>อยากได้ลิงก์แอฟของตัวเอง ต้องมี Affiliate ID เท่านั้น</b>
        <ol>
          <li>เปิดสินค้าแล้วกด “เอาลิงก์ของฉัน”</li>
          <li>ใส่ Affiliate ID ของคุณ (ตัวเลข ดูได้ที่ affiliate.shopee.co.th)</li>
          <li>คัดลอกลิงก์แอฟของคุณไปปักตะกร้าได้เลย</li>
        </ol>
      </div>
      <ul className="upgrade-list">
        <li>ปลดล็อคตะกร้า Top 5 (ท็อปรวม · มาแรง · รายหมวด)</li>
        <li>ดูได้ทุกตัว ทุกหมวด{lim.oneCat ? " ไม่จำกัดวันละ 1 หมวด" : ""}</li>
        <li>AI ไอเดียคลิปวันละ 30 ตัว · ทำลิงก์ไม่จำกัด</li>
        <li>ขั้นสูง: ลิงก์อัตโนมัติ Top 20 และสแกนหมวดของคุณเอง (ใช้คอม)</li>
      </ul>
      <div className="bar">
        <a className="btn primary" href={UPGRADE_URL} target="_blank" rel="noopener">{offer?.founding ? `รับราคา Founding ฿${month}/เดือน` : `อัปเกรดเป็น Pro ฿${month}/เดือน`}</a>
        <span className="hint">หรือ ฿{year.toLocaleString("en-US")}/ปี{offer?.founding ? " · ราคานี้ล็อกไว้ตลอดไป (ปกติ ฿199)" : ""} · ชำระผ่าน LINE</span>
      </div>
    </section>
  );
}

function Step({ done, current, title, hint, children }) {
  return (
    <li className={"ob-step" + (done ? " done" : current ? " current" : "")}>
      <span className="ob-dot" aria-hidden="true">{done ? "✓" : ""}</span>
      <div style={{ minWidth: 0 }}>
        <b>{title}</b>
        {!done && current && <><p className="hint" style={{ margin: "2px 0 8px" }}>{hint}</p><div className="bar">{children}</div></>}
      </div>
    </li>
  );
}
function mobileUA() {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);
}

function ShopeeOffInfo() {
  return (
    <details className="explain">
      <summary>ถ้าออกจาก Shopee Affiliate หรือปิดคอม ข้อมูลจะเป็นยังไง?</summary>
      <div className="explain-body">
        <p><b className="ok">✓ ยังใช้ได้</b> สินค้าที่สแกนไว้ คะแนน และลิงก์ที่สร้างแล้ว เก็บไว้ในบัญชีปั๊กปักของคุณ เปิดจากมือถือหรือคอมเครื่องไหนก็เห็น ลิงก์ยังใช้ได้และค่าคอมยังเข้าบัญชีคุณ</p>
        <p><b className="no">✗ ต้องล็อกอินก่อน</b> สแกนสินค้าใหม่ อัปเดตข้อมูล และสร้างลิงก์ใหม่ ต้องใช้คอมที่ติดตั้ง Connector และล็อกอิน Shopee Affiliate อยู่</p>
        <p><b className="warn">! อาจเปลี่ยน</b> ค่าคอม ราคา และยอดขาย เป็นข้อมูล ณ วันที่สแกน ดูป้าย “อัปเดต…” ถ้าเกิน 3 วันควรอัปเดตก่อนทำคลิป โดยเฉพาะช่วงแคมเปญอย่าง 11.11</p>
      </div>
    </details>
  );
}
