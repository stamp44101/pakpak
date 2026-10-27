"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { effPrice, rank } from "../lib/score";

const EXT_ID = process.env.NEXT_PUBLIC_EXT_ID || "oemnhmceapililgkfdfjamhbdpkkjbbm";
const PRESETS = [
  ["ของใช้ในบ้าน", ["ที่เก็บของ", "ไม้ถูพื้น"]],
  ["ห้องครัว", ["อุปกรณ์ครัว", "หม้อทอดไร้น้ำมัน"]],
  ["ความงาม", ["กันแดด", "ที่ม้วนผม"]],
  ["แก็ดเจ็ต", ["พัดลมพกพา", "หูฟังบลูทูธ"]],
  ["สัตว์เลี้ยง", ["ของเล่นแมว", "ทรายแมว"]],
];
const STORE = "pukpak.v1";
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

// ---- local storage + sync key (the key IS the account; shared to other devices by a 6-digit code) ----
const ls = {
  get(k) { try { return localStorage.getItem(STORE + k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(STORE + k) : localStorage.setItem(STORE + k, v); } catch {} },
};
function syncKey(create = true) {
  let t = ls.get(".key");
  if (!t && create) {
    const a = new Uint8Array(32); crypto.getRandomValues(a);
    t = Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
    ls.set(".key", t);
  }
  return t;
}
async function api(path, method = "GET", body) {
  const key = syncKey();
  const r = await fetch(path, { method, headers: { authorization: "Bearer " + key, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  if (!r) return { error: "เชื่อมต่อ server ไม่ได้" };
  return r.json().catch(() => ({ error: "server error " + r.status }));
}
function loadLocal() { try { return JSON.parse(ls.get("") || "{}"); } catch { return {}; } }

export default function Home() {
  const [extOk, setExtOk] = useState(null); // null=checking
  const [account, setAccount] = useState(null); // live Shopee Affiliate session via Connector
  const [linked, setLinked] = useState(null); // account name saved on the server (seen from any device)
  const [products, setProducts] = useState({});
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState("");
  const [cat, setCat] = useState("");
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState("");
  const [aiBusy, setAiBusy] = useState(null);
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  const [pair, setPair] = useState(null); // {code, qr, expires}
  const [code, setCode] = useState("");
  const [mobile, setMobile] = useState(false);
  const poll = useRef(null);
  const saveT = useRef(null);
  const skipSave = useRef(true);

  const say = (t) => { setToast(t); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 2800); };

  // ---- load: local first, then the server copy if it is newer ----
  async function pullState() {
    const local = loadLocal();
    const hasLocal = local.products && Object.keys(local.products).length > 0;
    if (!syncKey(false) && !hasLocal) { setReady(true); return; }
    const remote = await api("/api/state");
    if (remote.error) { setSync("ออฟไลน์"); setReady(true); return; }
    if (remote.account) setLinked(remote.account);
    if ((remote.updatedAt || 0) > (local.savedAt || 0)) {
      skipSave.current = true;
      setProducts(remote.products || {});
      ls.set("", JSON.stringify({ products: remote.products || {}, savedAt: remote.updatedAt }));
    } else if (hasLocal) {
      // this device has newer data (e.g. from before sync existed): upload it
      const r = await api("/api/state", "PUT", { products: local.products, account: remote.account || null });
      if (!r.error) ls.set("", JSON.stringify({ products: local.products, savedAt: r.updatedAt }));
    }
    setReady(true);
  }
  useEffect(() => {
    setMobile(typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent)));
    skipSave.current = true;
    setProducts(loadLocal().products || {});
    const q = new URLSearchParams(location.search).get("pair");
    if (q) { history.replaceState(null, "", "/"); claim(q); } else pullState();
  }, []);

  // ---- save: local now, server after a short pause ----
  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) { skipSave.current = false; return; }
    const savedAt = Date.now();
    ls.set("", JSON.stringify({ products, savedAt }));
    clearTimeout(saveT.current);
    setSync("กำลังบันทึก…");
    saveT.current = setTimeout(async () => {
      const r = await api("/api/state", "PUT", { products, account: account ? account.name : linked });
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
    if (s.loggedIn && s.name !== linked) { setLinked(s.name); api("/api/state", "PUT", { account: s.name }); }
    return !!s.loggedIn;
  }
  useEffect(() => { checkStatus(); }, []);
  useEffect(() => () => { clearInterval(poll.current); clearTimeout(saveT.current); }, []);

  async function login() {
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

  function logout(clearData) {
    clearInterval(poll.current);
    setConfirmOut(false); setPair(null);
    if (extOk) ls.set(".out", "1");
    setAccount(null);
    if (clearData) {
      skipSave.current = true;
      setProducts({}); setCat(""); setOpen(null); setLinked(null);
      ls.set("", null); ls.set(".key", null); // forget this device's link to the account
    }
    say(clearData ? "ออกจากระบบและล้างข้อมูลในเครื่องนี้แล้ว" : "ออกจากระบบแล้ว");
  }

  // ---- open on phone ----
  async function makePair() {
    const r = await api("/api/pair", "POST");
    if (r.error) return say("สร้างรหัสไม่สำเร็จ: " + r.error);
    const url = `${location.origin}/?pair=${r.code}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 }).catch(() => "");
    setPair({ code: r.code, qr, url, expires: r.expires });
  }
  async function claim(c) {
    const clean = String(c || "").replace(/\D/g, "");
    if (clean.length !== 6) return say("ใส่รหัส 6 หลัก");
    setBusy("กำลังเชื่อมอุปกรณ์…");
    const r = await fetch("/api/pair", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: clean }) }).then((x) => x.json()).catch(() => ({ error: "เชื่อมต่อ server ไม่ได้" }));
    setBusy("");
    if (r.error || !r.token) { say(r.error || "เชื่อมไม่สำเร็จ"); setReady(true); return; }
    ls.set(".key", r.token); ls.set("", null); setCode("");
    await pullState();
    setLinked((v) => v || "ของคุณ");
    say("เชื่อมอุปกรณ์นี้แล้ว");
  }

  // ---- data ----
  async function pull(keywords, category) {
    if (!account) return say("ล็อกอิน Shopee Affiliate ก่อน");
    setBusy("กำลังดึงสินค้า…");
    const next = { ...products };
    let added = 0;
    for (const k of keywords) {
      for (const offset of [0, 20]) {
        const r = await ext({ type: "search", opts: { keyword: k, offset, limit: 20, sortType: 2 } });
        if (r.error) { setBusy(""); if (r.error === "not_logged_in") setAccount(null); return say("ดึงไม่สำเร็จ: " + r.error); }
        for (const it of r.items) {
          const old = next[it.id];
          const { longLink, ...rest } = it; // keep the saved copy small
          next[it.id] = { ...old, ...rest, category: category || old?.category || k, keyword: k, fetchedAt: Date.now() };
          if (!old) added++;
        }
      }
    }
    setProducts(next); setBusy(""); say(`ได้สินค้าใหม่ ${added} ตัว`);
  }

  const patch = (id, data) => setProducts((prev) => ({ ...prev, [id]: { ...prev[id], ...data } }));

  async function scoreOne(p, refresh = false) {
    setAiBusy(p.id);
    const r = await api("/api/score", "POST", { item: { id: p.id, name: p.name, price: effPrice(p), category: p.category }, refresh });
    setAiBusy(null);
    if (r.error) return say("AI ให้คะแนนไม่สำเร็จ: " + r.error);
    patch(p.id, { ai: { ...r.score, cached: r.cached } });
    say(r.cached ? "ได้คะแนนจากคลัง ไม่เสียค่า AI" : "AI ให้คะแนนแล้ว");
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
  const ranked = useMemo(() => rank(all.filter((p) => !cat || p.category === cat)), [products, cat]);
  const viewOnly = !account && !!linked; // phone, or a computer without the Connector

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>ปั๊กปัก</h1>
          <p className="sub">ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</p>
        </div>
        <div className="bar">
          <span className={"src" + (account || linked ? " ok" : "")}><i />
            {account ? `Shopee Affiliate: ${account.name}` : linked ? `บัญชี ${linked} · เชื่อมจากคอม` : "ยังไม่เชื่อม Shopee Affiliate"}
          </span>
          {sync && <span className="hint">{sync}</span>}
          {account && !pair && <button className="btn" onClick={makePair}>เปิดบนมือถือ</button>}
          {(account || linked) && !confirmOut && <button className="btn" onClick={() => setConfirmOut(true)}>ออกจากระบบ</button>}
        </div>
      </header>

      {confirmOut && (
        <section className="panel">
          <h2>ออกจากระบบปั๊กปัก</h2>
          <p className="hint">{account ? "ปั๊กปักจะหยุดอ่านข้อมูลจาก Shopee Affiliate จนกว่าจะกดเชื่อมใหม่ ถ้าจะเดโมขั้นล็อกอิน Shopee ด้วย ให้ออกจากระบบในแท็บ Shopee Affiliate อีกที" : "อุปกรณ์นี้จะเลิกเชื่อมกับบัญชี ข้อมูลบนบัญชียังอยู่ครบ เชื่อมใหม่ได้ด้วยรหัสจากคอม"}</p>
          <div className="bar">
            {account && <button className="btn primary" onClick={() => logout(false)}>ออกจากระบบ (เก็บข้อมูลไว้)</button>}
            <button className={"btn" + (account ? "" : " primary")} onClick={() => logout(true)}>{account ? "ออกและล้างข้อมูลในเครื่องนี้" : "เลิกเชื่อมอุปกรณ์นี้"}</button>
            <button className="btn" onClick={() => setConfirmOut(false)}>ยกเลิก</button>
          </div>
        </section>
      )}

      {pair && (
        <section className="panel pair">
          {pair.qr && <img src={pair.qr} alt="QR สำหรับเปิดปั๊กปักบนมือถือ" width="180" height="180" />}
          <div style={{ minWidth: 0 }}>
            <h2>เปิดปั๊กปักบนมือถือ</h2>
            <p className="hint">สแกน QR ด้วยกล้องมือถือ หรือเปิด pakpak บนมือถือแล้วใส่รหัสนี้ ใช้ได้ 10 นาที ครั้งเดียว</p>
            <div className="code num">{pair.code}</div>
            <div className="bar"><button className="btn" onClick={() => setPair(null)}>ปิด</button></div>
          </div>
        </section>
      )}

      {!account && !linked && (
        <section className="panel">
          <h2>{mobile ? "เชื่อมมือถือกับบัญชีปั๊กปัก" : "เชื่อม Shopee Affiliate ของคุณ"}</h2>
          <div className="steps">
            {!mobile && <>
              <div className="step">
                <span className={"badge" + (extOk ? " done" : "")}>{extOk ? "✓" : "1"}</span>
                <div><b>ติดตั้ง ปั๊กปัก Connector</b>
                  <p className="hint">{extOk === null ? "กำลังตรวจ…" : extOk ? "ติดตั้งแล้ว" : "ส่วนเสริม Chrome ที่อ่านข้อมูลจากแท็บที่คุณล็อกอินไว้"}</p>
                  {extOk === false && <div className="bar" style={{ marginTop: 6 }}><a className="btn" href="/connector" target="_blank" rel="noopener">วิธีติดตั้ง</a><button className="btn" onClick={checkStatus}>ตรวจอีกครั้ง</button></div>}
                </div>
              </div>
              <div className="step">
                <span className="badge">2</span>
                <div><b>ล็อกอิน Shopee Affiliate</b>
                  <p className="hint">เปิดแท็บ Shopee Affiliate ให้คุณล็อกอิน ระบบจะรู้เองเมื่อล็อกอินเสร็จ</p>
                  <div className="bar" style={{ marginTop: 6 }}><button className="btn primary" disabled={!extOk} onClick={login}>ล็อกอิน Shopee Affiliate ↗</button></div>
                </div>
              </div>
            </>}
            <div className="step">
              <span className="badge">{mobile ? "1" : "หรือ"}</span>
              <div style={{ minWidth: 0 }}><b>{mobile ? "ใส่รหัสจากคอม" : "เชื่อมจากคอมเครื่องอื่นแล้ว?"}</b>
                <p className="hint">{mobile ? "บนคอมที่เชื่อม Shopee Affiliate ไว้ กด “เปิดบนมือถือ” แล้วสแกน QR หรือใส่รหัส 6 หลักที่นี่" : "ใส่รหัส 6 หลักจากปุ่ม “เปิดบนมือถือ” ของเครื่องนั้น"}</p>
                <form className="bar" style={{ marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); claim(code); }}>
                  <input id="paircode" className="num" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{ width: 120 }} />
                  <button className="btn primary" disabled={!!busy}>เชื่อม</button>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}

      {account && (
        <section className="panel">
          <h2>ดึงสินค้าจาก Shopee Affiliate</h2>
          <div className="bar">
            {PRESETS.map(([c, kws]) => <button key={c} className="chip" disabled={!!busy} onClick={() => pull(kws, c)}>{c}</button>)}
          </div>
          <form className="bar" onSubmit={(e) => { e.preventDefault(); kw.trim() && pull([kw.trim()], ""); }}>
            <input className="grow" id="kw" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="หรือพิมพ์คำค้น เช่น แปรงขัดห้องน้ำ" />
            <button className="btn" disabled={!!busy}>ดึงสินค้า</button>
          </form>
        </section>
      )}
      {viewOnly && <p className="hint">อุปกรณ์นี้ดูและก๊อปลิงก์ได้ ส่วนการดึงสินค้าใหม่และสร้างลิงก์ทำบนคอมที่ติดตั้ง Connector</p>}

      {(
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="bar">
            <button className={"chip" + (!cat ? " on" : "")} onClick={() => setCat("")}>ทุกหมวด</button>
            {cats.map((c) => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          {busy && <p className="hint">{busy}</p>}
          <div className="list">
            {!ranked.length && <div className="empty"><strong>ยังไม่มีสินค้า</strong><span>{ready ? "เชื่อม Shopee Affiliate แล้วกดเลือกหมวดด้านบนเพื่อดึงสินค้า" : "กำลังโหลด…"}</span></div>}
            {ranked.map((p, i) => (
              <div key={p.id} className={"row" + (i < 10 ? " top10" : "")} onClick={(e) => { if (!e.target.closest(".detail")) setOpen(open === p.id ? null : p.id); }}>
                <div className="rank">{i + 1}</div>
                {p.image ? <img className="thumb" src={img(p.image)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="thumb" />}
                <div style={{ minWidth: 0 }}>
                  <div className="name">{p.name}</div>
                  <div className="meta">
                    <span>฿<span className="num">{fmt(effPrice(p))}</span></span>
                    <span>ขาย <span className="num">{fmt(p.sold)}</span></span>
                    <span>คอม <span className="num">{fmt(p.commission)}%</span> ≈ ฿<span className="num">{fmt(p._perOrder)}</span>/ชิ้น</span>
                    <span>★ <span className="num">{fmt(p.rating)}</span></span>
                    {p.shop && <span className="tag">{p.shop}</span>}
                  </div>
                </div>
                <div className="scores">
                  <div className="sline"><span>data</span><div className="track"><div className="fill" style={{ width: `${(p._d.total / p._d.max) * 100}%` }} /></div><span className="num">{Math.round(p._d.total)}</span></div>
                  <div className="sline"><span>AI</span><div className="track"><div className="fill ai" style={{ width: `${p._a ? (p._a.total / p._a.max) * 100 : 0}%` }} /></div><span className="num">{p._a ? Math.round(p._a.total) : "–"}</span></div>
                </div>
                <div className="total">{Math.round(p._t)}</div>
                {open === p.id && (
                  <div className="detail">
                    {p.image && <a href={p.url || img(p.image, "")} target="_blank" rel="noopener"><img className="hero" src={img(p.image, "")} alt={p.name} loading="lazy" referrerPolicy="no-referrer" /></a>}
                    {p.ai ? <>
                      <div className="hook">“{p.ai.hook}”</div>
                      {p.ai.angles?.length > 0 && <ol className="angles">{p.ai.angles.map((a, k) => <li key={k}>{a}</li>)}</ol>}
                      <div className="why">{p.ai.why}</div>
                      <div className="hint">{p.ai.cached ? "คะแนนจากคลังของปั๊กปัก" : "AI ให้คะแนนแล้ว"}</div>
                    </> : <div className="bar">
                      <button className="btn primary" disabled={aiBusy === p.id} onClick={() => scoreOne(p)}>{aiBusy === p.id ? "AI กำลังให้คะแนน…" : "ให้ AI ให้คะแนนตัวนี้"}</button>
                      <span className="hint">ถ้ามีคนให้คะแนนสินค้านี้แล้ว จะได้คะแนนทันทีโดยไม่เสียค่า AI</span>
                    </div>}
                    {p.affLink && <div className="linkbox">{p.affLink} · Sub ID: pukpak / {p.subId}</div>}
                    <div className="bar">
                      {p.affLink && <button className="btn primary" onClick={() => copyLink(p)}>คัดลอกลิงก์</button>}
                      {account && !p.affLink && <button className="btn primary" onClick={() => makeLink(p)}>สร้างลิงก์ affiliate</button>}
                      {p.url && <a className="btn" href={p.url} target="_blank" rel="noopener">หน้าสินค้า ↗</a>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
