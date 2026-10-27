"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_W, effPrice, rank } from "../lib/score";

const EXT_ID = process.env.NEXT_PUBLIC_EXT_ID || "oemnhmceapililgkfdfjamhbdpkkjbbm";
const PRESETS = [
  ["ของใช้ในบ้าน", ["ที่เก็บของ", "ไม้ถูพื้น"]],
  ["ห้องครัว", ["อุปกรณ์ครัว", "หม้อทอดไร้น้ำมัน"]],
  ["ความงาม", ["กันแดด", "ที่ม้วนผม"]],
  ["แก็ดเจ็ต", ["พัดลมพกพา", "หูฟังบลูทูธ"]],
  ["สัตว์เลี้ยง", ["ของเล่นแมว", "ทรายแมว"]],
];
const STORE = "pukpak.v1";
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

function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }

export default function Home() {
  const [extOk, setExtOk] = useState(null); // null=checking
  const [account, setAccount] = useState(null);
  const [products, setProducts] = useState({});
  const [view, setView] = useState("pick");
  const [cat, setCat] = useState("");
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  const poll = useRef(null);

  // restore + persist (per browser for v1)
  useEffect(() => { setProducts(load().products || {}); }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ products })); } catch {} }, [products]);
  const say = (t) => { setToast(t); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 2800); };

  const isOut = () => { try { return localStorage.getItem(STORE + ".out") === "1"; } catch { return false; } };
  const setOut = (v) => { try { v ? localStorage.setItem(STORE + ".out", "1") : localStorage.removeItem(STORE + ".out"); } catch {} };

  async function checkStatus() {
    const p = await ext({ type: "ping" }, 3000);
    setExtOk(!p.error);
    if (p.error) return false;
    if (isOut()) { setAccount(null); return false; } // user signed out of ปั๊กปัก; wait for them to connect again
    const s = await ext({ type: "status" });
    setAccount(s.loggedIn ? s : null);
    return !!s.loggedIn;
  }
  useEffect(() => { checkStatus(); }, []);
  useEffect(() => () => clearInterval(poll.current), []);

  async function login() {
    setOut(false);
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
    setOut(true);
    setAccount(null);
    setConfirmOut(false);
    if (clearData) { setProducts({}); setCat(""); setOpen(null); }
    say(clearData ? "ออกจากระบบและล้างข้อมูลแล้ว" : "ออกจากระบบแล้ว");
  }

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
          next[it.id] = { ...old, ...it, category: category || old?.category || k, keyword: k, fetchedAt: Date.now() };
          if (!old) added++;
        }
      }
    }
    setProducts(next); setBusy(""); say(`ได้สินค้าใหม่ ${added} ตัว`);
  }

  async function scoreAI() {
    const todo = Object.values(products).filter((p) => !p.ai);
    if (!todo.length) return;
    setBusy(`AI กำลังให้คะแนน 0/${todo.length}`);
    let done = 0;
    for (let i = 0; i < todo.length; i += 10) {
      const chunk = todo.slice(i, i + 10).map((p) => ({ id: p.id, name: p.name, price: effPrice(p), category: p.category }));
      const r = await fetch("/api/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: chunk }) }).then((r) => r.json()).catch(() => ({ error: "network" }));
      if (r.error) { setBusy(""); return say("AI ให้คะแนนไม่สำเร็จ: " + r.error); }
      setProducts((prev) => { const n = { ...prev }; for (const s of r.scores) if (n[s.id]) n[s.id] = { ...n[s.id], ai: s }; return n; });
      done += chunk.length; setBusy(`AI กำลังให้คะแนน ${done}/${todo.length}`);
    }
    setBusy(""); say("AI ให้คะแนนครบแล้ว");
  }

  const patch = (id, data) => setProducts((prev) => ({ ...prev, [id]: { ...prev[id], ...data } }));

  async function makeLink(p) {
    const group = p.pick || "X";
    const idx = Object.values(products).filter((x) => x.pick === group && x.subId).length + 1;
    const subId = p.subId || `${group}${idx}`;
    const r = await ext({ type: "links", items: [{ itemId: p.itemId, shopId: p.shopId }], subIds: ["pukpak", subId] });
    if (r.error || !r.links?.[0]) return say("สร้างลิงก์ไม่สำเร็จ: " + (r.error || "ไม่มีลิงก์"));
    patch(p.id, { affLink: r.links[0].link, subId });
    try { await navigator.clipboard.writeText(r.links[0].link); say("สร้างและคัดลอกลิงก์แล้ว"); } catch { say("สร้างลิงก์แล้ว"); }
  }

  const all = Object.values(products);
  const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];
  const ranked = useMemo(() => rank(all.filter((p) => !cat || p.category === cat)), [products, cat]);
  const unscored = all.filter((p) => !p.ai).length;

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>ปั๊กปัก</h1>
          <p className="sub">ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</p>
        </div>
        <div className="bar">
          <span className={"src" + (account ? " ok" : "")}><i />{account ? `Shopee Affiliate: ${account.name}` : "ยังไม่เชื่อม Shopee Affiliate"}</span>
          {account && !confirmOut && <button className="btn" onClick={() => setConfirmOut(true)}>ออกจากระบบ</button>}
        </div>
      </header>

      {confirmOut && (
        <section className="panel">
          <h2>ออกจากระบบปั๊กปัก</h2>
          <p className="hint">ปั๊กปักจะหยุดอ่านข้อมูลจาก Shopee Affiliate จนกว่าจะกดเชื่อมใหม่ ถ้าจะเดโมขั้นล็อกอิน Shopee ด้วย ให้ออกจากระบบในแท็บ Shopee Affiliate อีกที</p>
          <div className="bar">
            <button className="btn primary" onClick={() => logout(false)}>ออกจากระบบ (เก็บสินค้าและผลคลิปไว้)</button>
            <button className="btn" onClick={() => logout(true)}>ออกและล้างข้อมูลทั้งหมด</button>
            <button className="btn" onClick={() => setConfirmOut(false)}>ยกเลิก</button>
          </div>
        </section>
      )}

      {!account && (
        <section className="panel">
          <h2>เชื่อม Shopee Affiliate ของคุณ</h2>
          <div className="steps">
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

      <nav role="tablist">
        {[["pick", "เลือกตะกร้า"], ["ab", "ผลคลิป A/B"]].map(([v, l]) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{l}</button>)}
      </nav>

      {view === "pick" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="bar">
            <button className={"chip" + (!cat ? " on" : "")} onClick={() => setCat("")}>ทุกหมวด</button>
            {cats.map((c) => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}
            <span style={{ flex: 1 }} />
            {all.length > 0 && <button className="btn primary" disabled={!!busy || !unscored} onClick={scoreAI}>{unscored ? `AI ให้คะแนน (${unscored})` : "AI ให้คะแนนครบแล้ว"}</button>}
          </div>
          {busy && <p className="hint">{busy}</p>}
          <div className="list">
            {!ranked.length && <div className="empty"><strong>ยังไม่มีสินค้า</strong><span>เชื่อม Shopee Affiliate แล้วกดเลือกหมวดด้านบนเพื่อดึงสินค้า</span></div>}
            {ranked.map((p, i) => (
              <div key={p.id} className={"row" + (i < 10 ? " top10" : "")} onClick={(e) => { if (!e.target.closest(".detail")) setOpen(open === p.id ? null : p.id); }}>
                <div className="rank">{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="name">{p.name}</div>
                  <div className="meta">
                    <span>฿<span className="num">{fmt(effPrice(p))}</span></span>
                    <span>ขาย <span className="num">{fmt(p.sold)}</span></span>
                    <span>คอม <span className="num">{fmt(p.commission)}%</span> ≈ ฿<span className="num">{fmt(p._perOrder)}</span>/ชิ้น</span>
                    <span>★ <span className="num">{fmt(p.rating)}</span></span>
                    {p.shop && <span className="tag">{p.shop}</span>}
                    {p.pick && <span className={"tag " + p.pick.toLowerCase()}>กลุ่ม {p.pick}</span>}
                  </div>
                </div>
                <div className="scores">
                  <div className="sline"><span>data</span><div className="track"><div className="fill" style={{ width: `${(p._d.total / p._d.max) * 100}%` }} /></div><span className="num">{Math.round(p._d.total)}</span></div>
                  <div className="sline"><span>AI</span><div className="track"><div className="fill ai" style={{ width: `${p._a ? (p._a.total / p._a.max) * 100 : 0}%` }} /></div><span className="num">{p._a ? Math.round(p._a.total) : "–"}</span></div>
                </div>
                <div className="total">{Math.round(p._t)}</div>
                {open === p.id && (
                  <div className="detail">
                    {p.ai ? <>
                      <div className="hook">“{p.ai.hook}”</div>
                      {p.ai.angles?.length > 0 && <ol className="angles">{p.ai.angles.map((a, k) => <li key={k}>{a}</li>)}</ol>}
                      <div className="why">{p.ai.why}</div>
                    </> : <div className="why">ยังไม่มีคะแนน AI</div>}
                    {p.affLink && <div className="linkbox">{p.affLink} · Sub ID: pukpak / {p.subId}</div>}
                    <div className="bar">
                      <button className="btn" onClick={() => patch(p.id, { pick: p.pick === "A" ? null : "A" })}>{p.pick === "A" ? "เอาออกจากกลุ่ม A" : "ใช้ทำคลิปกลุ่ม A"}</button>
                      <button className="btn" onClick={() => patch(p.id, { pick: p.pick === "B" ? null : "B" })}>{p.pick === "B" ? "เอาออกจากกลุ่ม B" : "ตั้งเป็น control กลุ่ม B"}</button>
                      <button className="btn primary" disabled={!account} onClick={() => makeLink(p)}>{p.affLink ? "คัดลอกลิงก์ใหม่" : "สร้างลิงก์ affiliate"}</button>
                      {p.url && <a className="btn" href={p.url} target="_blank" rel="noopener">หน้าสินค้า ↗</a>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "ab" && <ABView products={products} patch={patch} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ABView({ products, patch }) {
  const picked = rank(Object.values(products).filter((p) => p.pick)).sort((a, b) => a.pick.localeCompare(b.pick) || b._t - a._t);
  const g = { A: { v: 0, o: 0, c: 0, e: 0, n: 0 }, B: { v: 0, o: 0, c: 0, e: 0, n: 0 } };
  for (const p of picked) { const c = p.clip || {}; if (+c.views > 0) { const s = g[p.pick]; s.n++; s.v += +c.views; s.o += +c.orders || 0; s.c += +c.clicks || 0; s.e += +c.earn || 0; } }
  const opk = (s) => (s.v ? (s.o / s.v) * 1000 : null);
  const A = opk(g.A), B = opk(g.B), ratio = A != null && B ? A / B : null;
  let verdict = <span className="pend">รอผลทั้งสองกลุ่ม</span>;
  if (ratio != null) verdict = ratio >= 2 ? <span className="pass">ผ่าน · A ดีกว่า {ratio.toFixed(1)} เท่า</span> : <span className="fail">ยังไม่ผ่าน · {ratio.toFixed(1)} เท่า</span>;
  else if (A != null && g.B.n && g.B.o === 0 && g.A.o > 0) verdict = <span className="pass">ผ่าน · B ยังไม่มี order</span>;
  const setClip = (p, f, v) => patch(p.id, { clip: { ...(p.clip || {}), [f]: v === "" ? null : +v } });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="verdict">
        <div className="vcard"><p className="hint">ผลตัดสิน go / no-go</p><div style={{ fontFamily: "var(--display)", fontSize: 18 }}>{verdict}</div></div>
        <div className="vcard"><p className="hint">Order ต่อ 1,000 views · A / B</p><div className="big">{A == null ? "–" : A.toFixed(2)} / {B == null ? "–" : B.toFixed(2)}</div></div>
        <div className="vcard"><p className="hint">ค่าคอมเฉลี่ยต่อคลิป (฿) · A / B</p><div className="big">{g.A.n ? fmt(g.A.e / g.A.n) : "–"} / {g.B.n ? fmt(g.B.e / g.B.n) : "–"}</div></div>
      </div>
      <p className="hint">กลุ่ม A = สินค้าจาก Top 10 · กลุ่ม B = สินค้าที่เลือกเองตามปกติ (control) · ผ่านเมื่อ order ต่อ 1,000 views ของ A ≥ 2 เท่าของ B · Sub ID ใช้ดูยอดในรายงานคำสั่งซื้อของ Shopee Affiliate</p>
      <div className="tablewrap">
        {!picked.length ? <div className="empty"><strong>ยังไม่ได้เลือกสินค้า</strong><span>เปิดสินค้าในแท็บ “เลือกตะกร้า” แล้วเลือกกลุ่ม A และ B อย่างละ 5 ตัว</span></div> :
          <table><thead><tr><th>กลุ่ม</th><th>สินค้า</th><th className="r">คะแนน</th><th>Sub ID</th><th>Views</th><th>Clicks</th><th>Orders</th><th>ค่าคอม ฿</th><th className="r">Order/1k</th></tr></thead>
            <tbody>{picked.map((p) => { const c = p.clip || {}; return (
              <tr key={p.id}>
                <td><span className={"tag " + p.pick.toLowerCase()}>{p.pick}</span></td>
                <td style={{ maxWidth: 260 }}>{p.name}</td>
                <td className="r num">{Math.round(p._t)}</td>
                <td className="num">{p.subId ? `pukpak/${p.subId}` : "–"}</td>
                {["views", "clicks", "orders", "earn"].map((f) => <td key={f}><input className="num" inputMode="decimal" id={`${f}-${p.id}`} defaultValue={c[f] ?? ""} onBlur={(e) => setClip(p, f, e.target.value)} /></td>)}
                <td className="r num">{+c.views ? (((+c.orders || 0) / c.views) * 1000).toFixed(2) : "–"}</td>
              </tr>); })}</tbody></table>}
      </div>
    </section>
  );
}
