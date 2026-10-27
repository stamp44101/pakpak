"use client";
// "บัญชีของฉัน": what this member has set up, what is missing, and what their plan includes.
import { useEffect, useState } from "react";

const EXT_ID = process.env.NEXT_PUBLIC_EXT_ID || "oemnhmceapililgkfdfjamhbdpkkjbbm";
const OA_ADD = "https://line.me/R/ti/p/@979soyth";
const UPGRADE_URL = "https://line.me/R/oaMessage/@979soyth/?" + encodeURIComponent("อัปเกรด Pro");
const thDate = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const mobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);

function ext(msg, timeout = 4000) {
  return new Promise((resolve) => {
    const rt = typeof window !== "undefined" && window.chrome && window.chrome.runtime;
    if (!rt || !rt.sendMessage) return resolve({ error: "no_extension" });
    const t = setTimeout(() => resolve({ error: "timeout" }), timeout);
    try { rt.sendMessage(EXT_ID, msg, (res) => { clearTimeout(t); resolve(rt.lastError || !res ? { error: "no_extension" } : res); }); }
    catch { clearTimeout(t); resolve({ error: "no_extension" }); }
  });
}

function Item({ state, title, detail, children }) {
  // state: ok | todo | info | off
  return (
    <li className={"st-item " + state}>
      <span className="st-dot" aria-hidden="true">{state === "ok" ? "✓" : state === "todo" ? "!" : state === "off" ? "–" : "i"}</span>
      <div className="st-body">
        <b>{title}</b>
        {detail && <p className="hint">{detail}</p>}
        {children && <div className="bar">{children}</div>}
      </div>
    </li>
  );
}

export default function Settings() {
  const [me, setMe] = useState(null);
  const [st, setSt] = useState(null);
  const [extOk, setExtOk] = useState(null);
  const [shopee, setShopee] = useState(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => setMe({ error: true }));
    fetch("/api/state").then((r) => r.json()).then(setSt).catch(() => setSt({}));
    (async () => {
      const p = await ext({ type: "ping" });
      setExtOk(!p.error);
      if (!p.error) { const s = await ext({ type: "status" }); setShopee(s.loggedIn ? s.name : false); }
    })();
  }, []);

  const m = me?.member;
  if (me && !m) return <div className="wrap" style={{ maxWidth: 680 }}><h1>บัญชีของฉัน</h1><p className="hint">เข้าสู่ระบบก่อนนะครับ</p><a className="btn primary" href="/api/auth/line">เข้าสู่ระบบด้วย LINE</a></div>;
  if (!m) return <div className="wrap" style={{ maxWidth: 680 }}><p className="hint">กำลังโหลด…</p></div>;

  const pro = m.plan === "pro";
  const products = Object.values(st?.products || {});
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const links = products.filter((p) => p.affLink).length;
  const newest = Math.max(0, ...products.map((p) => p.fetchedAt || 0));
  const linkedName = st?.account;
  const lim = m.limits || {};

  const coreDone = 1 + (m.botSeenAt ? 1 : 0); // LINE sign-in + bot
  const extraDone = [extOk || linkedName, linkedName, products.length > 0].filter(Boolean).length;

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <header className="top">
        <div className="brand">
          {m.picture ? <img className="avatar" style={{ width: 48, height: 48 }} src={m.picture} alt="" referrerPolicy="no-referrer" /> : null}
          <div><h1>บัญชีของฉัน</h1><p className="sub">{m.name} · สมัคร {m.joinedAt ? thDate(m.joinedAt) : "–"}</p></div>
        </div>
        <a className="btn" href="/">← กลับไปปั๊กปัก</a>
      </header>

      <section className={"panel plan-card " + (pro ? "pro" : "free")}>
        <div className="plan-head">
          <div>
            <span className={"plan " + (pro ? "pro" : "free")}>{pro ? "Pro" : "Free"}{m.earlyAccess && pro && <em>Early Access</em>}</span>
            <p className="plan-until">{pro ? (m.proUntil ? `ใช้ได้ถึง ${thDate(m.proUntil)} (อีก ${Math.max(0, Math.ceil((m.proUntil - Date.now()) / 864e5))} วัน)` : "ไม่หมดอายุ") : "แพ็กฟรี"}</p>
          </div>
          <a className="btn primary" href={UPGRADE_URL} target="_blank" rel="noopener">{pro ? (m.proUntil ? "ต่ออายุ Pro" : "ติดต่อแอดมิน") : "อัปเกรดเป็น Pro"}</a>
        </div>
        {m.pendingOrder && <p className="hint pending">{m.pendingOrder.slipAt ? "ส่งสลิปแล้ว แอดมินกำลังตรวจสอบ" : "เลือกแพ็กแล้ว รอส่งสลิปในแชท LINE"} · {m.pendingOrder.plan === "year" ? "รายปี" : "รายเดือน"}</p>}
        <div className="usage">
          <span>AI วันนี้</span>
          <div className="track"><div className="fill ai" style={{ width: `${Math.min(100, ((m.aiToday || 0) / (lim.aiPerDay || 1)) * 100)}%` }} /></div>
          <b className="num">{m.aiToday || 0}/{lim.aiPerDay}</b>
        </div>
        <ul className="feat">
          <li className={lim.scan ? "y" : "n"}>สแกนหมวดและคำค้นของคุณเอง (Connector)</li>
          <li className={lim.autoLinks ? "y" : "n"}>ลิงก์ affiliate Top 20 สร้างให้อัตโนมัติ</li>
          <li className="y">{lim.topPerCat ? `ท็อป ${lim.topPerCat} ต่อหมวดจากคลังกลาง` : "ดูได้ทุกตัว ทุกหมวด"}</li>
          <li className="y">AI ไอเดียคลิป วันละ {lim.aiPerDay} ตัว</li>
          <li className="y">ใช้งานในแชท LINE</li>
        </ul>
      </section>

      <section className="panel">
        <div className="bar" style={{ justifyContent: "space-between" }}>
          <h2>ใช้งานบนมือถือ</h2>
          <span className="hint">พร้อมแล้ว <b className="num">{coreDone}/2</b></span>
        </div>
        <ol className="st-list">
          <Item state="ok" title="เข้าสู่ระบบด้วย LINE" detail={`บัญชี ${m.name}`} />
          <Item state={m.botSeenAt ? "ok" : "todo"} title="ใช้ปั๊กปักในแชท LINE"
            detail={m.botSeenAt ? "บอทพร้อมตอบ ลองกด “ท็อป 5 วันนี้” ที่เมนูด้านล่างแชท" : "เพิ่มเพื่อน LINE ปั๊กปัก แล้วกดเมนู “ท็อป 5 วันนี้” ใช้บนมือถือได้โดยไม่ต้องเปิดคอม"}>
            {!m.botSeenAt && <a className="btn primary" href={OA_ADD} target="_blank" rel="noopener">เพิ่มเพื่อน @979soyth</a>}
          </Item>
          {!pro && <Item state="info" title="เอาลิงก์ของคุณเองผ่านแอป Shopee" detail="เปิดสินค้าในแอป Shopee → กดปุ่มแชร์ ↗ มุมขวาบน → คัดลอกลิงก์ = ลิงก์ affiliate ของคุณ (ล็อกอินแอปด้วยบัญชีที่สมัคร Shopee Affiliate)" />}
        </ol>
      </section>

      {pro && (
        <section className="panel">
          <div className="bar" style={{ justifyContent: "space-between" }}>
            <h2>สแกนเองบนคอม <span className="hint">(ไม่บังคับ)</span></h2>
            <span className="hint">พร้อมแล้ว <b className="num">{extraDone}/3</b></span>
          </div>
          <p className="hint" style={{ margin: 0 }}>ถ้ายังไม่ทำส่วนนี้ ก็ใช้ท็อปจากคลังกลาง และเอาลิงก์ผ่านแอป Shopee ได้ตามปกติ</p>
          <ol className="st-list">
            <Item state={extOk ? "ok" : linkedName ? "info" : "off"} title="ติดตั้ง Connector (Chrome บนคอม)"
              detail={extOk ? "ติดตั้งในเบราว์เซอร์นี้แล้ว" : mobile() ? "ติดตั้งได้เฉพาะ Chrome บนคอม ไม่จำเป็นถ้าใช้แค่มือถือ" : linkedName ? "เคยใช้จากคอมเครื่องอื่นแล้ว เครื่องนี้ยังไม่ได้ติดตั้ง" : "ใช้สแกนหมวดของคุณเองและสร้างลิงก์อัตโนมัติ ใช้เวลาราว 1 นาที"}>
              {!extOk && !mobile() && <a className="btn" href="/connector" target="_blank" rel="noopener">วิธีติดตั้ง</a>}
            </Item>
            <Item state={shopee ? "ok" : linkedName ? "info" : "off"} title="เชื่อม Shopee Affiliate"
              detail={shopee ? `ล็อกอินอยู่: ${shopee}` : linkedName ? `บัญชีที่เคยเชื่อม: ${linkedName} · ตอนนี้ไม่ได้ล็อกอินในเบราว์เซอร์นี้ ลิงก์เดิมยังใช้ได้` : "ล็อกอิน Shopee Affiliate ใน Chrome ที่ติดตั้ง Connector แล้ว ระบบจะรู้เอง"}>
              {!shopee && extOk && <a className="btn" href="/">ไปเชื่อม Shopee</a>}
            </Item>
            <Item state={products.length ? "ok" : "off"} title="ข้อมูลตะกร้าของคุณ"
              detail={products.length ? `${products.length} สินค้า · ${cats.length} หมวด · ลิงก์ ${links} อัน · อัปเดตล่าสุด ${thDate(newest)}` : "ยังไม่ได้สแกนเอง ตอนนี้ใช้ท็อปจากคลังกลางไปก่อนได้"} />
          </ol>
        </section>
      )}

      {m.payments?.length > 0 && (
        <section className="panel">
          <h2>ประวัติการชำระเงิน</h2>
          <ul className="pay-list">
            {m.payments.slice().reverse().map((p, i) => <li key={i}><span>{thDate(p.at)}</span><span>Pro {p.plan === "year" ? "รายปี" : "รายเดือน"}</span><b className="num">฿{p.amount.toLocaleString("en-US")}</b></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
