"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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

export default function Home() {
  const [me, setMe] = useState(null); // {member, seats, left, loginReady}
  const [extOk, setExtOk] = useState(null);
  const [account, setAccount] = useState(null); // live Shopee Affiliate session via Connector
  const [linked, setLinked] = useState(null); // Shopee account name saved on the member
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
  const poll = useRef(null);
  const saveT = useRef(null);
  const skipSave = useRef(true);

  const say = (t) => { setToast(t); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 3000); };
  const member = me && me.member;
  const active = member && member.status === "active";

  // ---- who am I ----
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("login")) { say(q.get("login") === "cancelled" ? "ยกเลิกการเข้าสู่ระบบ" : "เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้ง"); history.replaceState(null, "", "/"); }
    skipSave.current = true;
    setProducts(loadLocal().products || {});
    api("/api/me").then((r) => setMe(r.error ? { member: null, left: 0, seats: 10, loginReady: false } : r));
  }, []);
  useEffect(() => { if (active) pullState(); }, [active]);

  // ---- load: server copy if newer, else upload what this device has ----
  async function pullState() {
    const local = loadLocal();
    const hasLocal = local.products && Object.keys(local.products).length > 0;
    const remote = await api("/api/state");
    if (remote.error) { setSync("ออฟไลน์"); setReady(true); return; }
    if (remote.account) setLinked(remote.account);
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
    if (!ready || !active) return;
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
    if (s.loggedIn && s.name !== linked) { setLinked(s.name); api("/api/state", "PUT", { account: s.name }); }
    return !!s.loggedIn;
  }
  useEffect(() => { if (active) checkStatus(); }, [active]);
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
    ls.set(".out", "1");
    if (clearLocal) ls.set("", null);
    skipSave.current = true;
    setAccount(null); setLinked(null); setProducts({}); setReady(false); setOpen(null); setCat("");
    setMe((m) => ({ ...m, member: null }));
    api("/api/me").then((r) => !r.error && setMe(r));
    say("ออกจากระบบแล้ว");
  }

  // ---- data ----
  async function pull(keywords, category) {
    if (!account) return say("เชื่อม Shopee Affiliate ก่อน");
    setBusy("กำลังดึงสินค้า…");
    const next = { ...products };
    let added = 0;
    for (const k of keywords) {
      for (const offset of [0, 20]) {
        const r = await ext({ type: "search", opts: { keyword: k, offset, limit: 20, sortType: 2 } });
        if (r.error) { setBusy(""); if (r.error === "not_logged_in") setAccount(null); return say("ดึงไม่สำเร็จ: " + r.error); }
        for (const it of r.items) {
          const old = next[it.id];
          const { longLink, ...rest } = it;
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
    if (r.error) return say(r.error);
    patch(p.id, { ai: { ...r.score, cached: r.cached } });
    say(r.cached ? "ได้คะแนนจากคลัง ไม่เสียโควต้า AI" : "AI ให้คะแนนแล้ว");
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
  const viewOnly = active && !account && extOk === false;

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>ปั๊กปัก</h1>
          <p className="sub">ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</p>
        </div>
        {member && (
          <div className="bar">
            {member.picture && <img className="avatar" src={member.picture} alt="" referrerPolicy="no-referrer" />}
            <span className="who">{member.name}</span>
            {active && <span className={"src" + (account ? " ok" : "")}><i />{account ? `Shopee: ${account.name}` : linked ? `Shopee: ${linked}` : "ยังไม่เชื่อม Shopee"}</span>}
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

      {me && !member && (
        <section className="panel hero-panel">
          <span className="eyebrow">Early Access</span>
          <h2 className="big">เลือกตะกร้าที่ทำคลิปแล้วขายได้ ก่อนเสียเวลาถ่าย</h2>
          <p className="hint">ปั๊กปักดึงสินค้าจาก Shopee Affiliate ของคุณ ให้คะแนนจากยอดขาย ค่าคอม รีวิว และให้ AI ประเมินว่าทำคลิปง่ายแค่ไหน พร้อม hook 3 วินาทีแรก</p>
          <div className="bar">
            <a className={"btn line" + (me.loginReady ? "" : " disabled")} href={me.loginReady ? "/api/auth/line" : undefined}>เข้าสู่ระบบด้วย LINE</a>
            <span className="seats">{me.left > 0 ? <>เหลือ <b className="num">{me.left}</b> จาก {me.seats} ที่</> : "Early Access เต็มแล้ว สมัครเพื่อเข้าคิวได้"}</span>
          </div>
          {!me.loginReady && <p className="hint">ระบบเข้าสู่ระบบยังตั้งค่าไม่เสร็จ</p>}
        </section>
      )}

      {member && member.status === "waitlist" && (
        <section className="panel">
          <h2>คุณอยู่ในคิว Early Access</h2>
          <p className="hint">ที่นั่ง {me.seats} ที่แรกเต็มแล้ว ตอนนี้คุณอยู่คิวที่ <b className="num">{member.waitlistPosition}</b> เราจะเปิดสิทธิ์ให้เมื่อมีที่ว่าง</p>
        </section>
      )}
      {member && member.status === "revoked" && (
        <section className="panel"><h2>บัญชีนี้ถูกระงับการใช้งาน</h2><p className="hint">ติดต่อผู้ดูแลปั๊กปักหากคิดว่าเป็นความผิดพลาด</p></section>
      )}

      {active && !account && extOk !== false && (
        <section className="panel">
          <h2>เชื่อม Shopee Affiliate ของคุณ</h2>
          <div className="steps">
            <div className="step">
              <span className={"badge" + (extOk ? " done" : "")}>{extOk ? "✓" : "1"}</span>
              <div><b>ติดตั้ง ปั๊กปัก Connector</b><p className="hint">{extOk === null ? "กำลังตรวจ…" : "ติดตั้งแล้ว"}</p></div>
            </div>
            <div className="step">
              <span className="badge">2</span>
              <div><b>ล็อกอิน Shopee Affiliate</b>
                <p className="hint">เปิดแท็บ Shopee Affiliate ให้คุณล็อกอิน ระบบจะรู้เองเมื่อล็อกอินเสร็จ</p>
                <div className="bar" style={{ marginTop: 6 }}><button className="btn primary" disabled={!extOk} onClick={connectShopee}>เชื่อม Shopee Affiliate ↗</button></div>
              </div>
            </div>
          </div>
        </section>
      )}
      {viewOnly && (
        <section className="panel">
          <p className="hint" style={{ margin: 0 }}>เครื่องนี้ดูคะแนนและก๊อปลิงก์ได้ ส่วนการดึงสินค้าใหม่และสร้างลิงก์ ใช้คอมที่ติดตั้ง <a href="/connector" target="_blank" rel="noopener">ปั๊กปัก Connector</a> (Chrome)</p>
        </section>
      )}

      {active && <>
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

      {(
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="bar">
            <button className={"chip" + (!cat ? " on" : "")} onClick={() => setCat("")}>ทุกหมวด</button>
            {cats.map((c) => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          {busy && <p className="hint">{busy}</p>}
          <div className="list">
            {!ranked.length && <div className="empty"><strong>ยังไม่มีสินค้า</strong><span>{ready ? (account ? "กดเลือกหมวดด้านบนเพื่อดึงสินค้า" : "เชื่อม Shopee Affiliate บนคอมเพื่อดึงสินค้า") : "กำลังโหลด…"}</span></div>}
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
      </>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
