"use client";
// "บัญชีของฉัน": what this member has set up, what is missing, and what their plan includes.
import { useEffect, useState } from "react";
import { orderOf } from "../../lib/plan";

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
  if (me && !m) return <div className="wrap" style={{ maxWidth: 680 }}><h1>บัญชีของฉัน</h1><p className="hint">เข้าสู่ระบบก่อนนะคะ</p><a className="btn primary" href="/api/auth/line">เข้าสู่ระบบด้วย LINE</a></div>;
  if (!m) return <div className="wrap" style={{ maxWidth: 680 }}><p className="hint">กำลังโหลด…</p></div>;

  const pro = m.plan === "pro";
  const products = Object.values(st?.products || {});
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const links = products.filter((p) => p.affLink).length;
  const newest = Math.max(0, ...products.map((p) => p.fetchedAt || 0));
  const linkedName = st?.account;
  // status reported by the Connector on the computer — what this phone shows when it has no Connector itself
  const seenAt = st?.shopeeSeenAt || 0;
  const remoteLive = !extOk && st?.shopeeLive && Date.now() - seenAt < 7 * 864e5;
  const agoTxt = (t) => { const mn = Math.round((Date.now() - t) / 6e4); return mn < 60 ? `${Math.max(1, mn)} นาทีก่อน` : mn < 1440 ? `${Math.round(mn / 60)} ชม.ก่อน` : `${Math.round(mn / 1440)} วันก่อน`; };
  const lim = m.limits || {};

  const appLinkDone = (m.onboarding?.done || []).includes("applink") || links > 0;
  const coreDone = 1 + (m.botSeenAt ? 1 : 0) + (appLinkDone ? 1 : 0);
  const extraDone = [extOk || linkedName, shopee || remoteLive, products.length > 0].filter(Boolean).length;

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
        {m.pendingOrder && <p className="hint pending">{m.pendingOrder.slipAt ? "ส่งสลิปแล้ว แอดมินกำลังตรวจสอบ" : "เลือกแพ็กแล้ว รอส่งสลิปในแชท LINE"} · {orderOf(m.pendingOrder.plan).label}</p>}
        {!pro && me.offer?.founding && <p className="hint founding">🎁 ราคา Founding ฿{me.offer.month}/เดือน หรือ ฿{me.offer.year.toLocaleString("en-US")}/ปี ล็อกไว้ตลอดไป{m.founding ? "" : ` · สมัครได้ถึง ${thDate(me.offer.foundingUntil)}`}</p>}
        {!pro && me.paywall?.countdown && <p className="hint pending">{me.paywall.countdown}</p>}
        <div className="usage">
          <span>AI วันนี้</span>
          <div className="track"><div className="fill ai" style={{ width: `${Math.min(100, ((m.aiToday || 0) / (lim.aiPerDay || 1)) * 100)}%` }} /></div>
          <b className="num">{m.aiToday || 0}/{lim.aiPerDay}</b>
        </div>
        <ul className="feat">
          <li className="y">{lim.oneCat ? `วันละ 1 หมวด ${lim.topPerCat} ตะกร้า (ท็อป 1–5 ล็อก)` : lim.topPerCat ? `ท็อป ${lim.topPerCat} ต่อหมวดจากคลังกลาง` : "ดูได้ทุกตัว ทุกหมวด"}</li>
          {lim.linksPerDay && <li className="y">ลิงก์ด้วย Affiliate ID วันละ {lim.linksPerDay} ลิงก์</li>}
          <li className="y">AI ไอเดียคลิป วันละ {lim.aiPerDay} ตัว</li>
          <li className="y">ใช้งานในแชท LINE + เอาลิงก์ผ่านแอป Shopee</li>
          <li className={lim.autoLinks ? "y" : "n"}>ขั้นสูง: ลิงก์อัตโนมัติ Top 20</li>
          <li className={lim.scan ? "y" : "n"}>ขั้นสูง: สแกนหมวดและคำค้นของคุณเอง</li>
        </ul>
      </section>

      <section className="panel">
        <div className="bar" style={{ justifyContent: "space-between" }}>
          <h2>เริ่มใช้บนมือถือ</h2>
          <span className="hint">พร้อมแล้ว <b className="num">{coreDone}/3</b></span>
        </div>
        <ol className="st-list">
          <Item state="ok" title="เข้าสู่ระบบด้วย LINE" detail={`บัญชี ${m.name}`} />
          <Item state={m.botSeenAt ? "ok" : "todo"} title="เพิ่มเพื่อน LINE ปั๊กปัก"
            detail={m.botSeenAt ? "บอทพร้อมตอบ กด “ท็อป 5 วันนี้” ที่เมนูด้านล่างแชทได้เลย" : "ในแชทกด “ท็อป 5 วันนี้” ที่เมนูด้านล่าง ได้ตะกร้าน่าทำคลิปทันที ไม่ต้องเปิดคอม"}>
            {!m.botSeenAt && <a className="btn primary" href={OA_ADD} target="_blank" rel="noopener">เพิ่มเพื่อน @979soyth</a>}
          </Item>
          <Item state={appLinkDone ? "ok" : "todo"} title="เอาลิงก์แอฟของคุณเอง 1 ตัว"
            detail="กด “เอาลิงก์ของฉัน” ใต้สินค้า แล้วใส่ Affiliate ID ของคุณ (ต้องมี Affiliate ID เท่านั้น ดูได้ที่ affiliate.shopee.co.th)">
            {!appLinkDone && <a className="btn" href="/">ไปเลือกสินค้า</a>}
          </Item>
        </ol>
      </section>

      <section className="panel" id="advanced">
        <div className="bar" style={{ justifyContent: "space-between" }}>
          <h2>ขั้นสูง <span className="hint">(เลือกเปิดเมื่ออยากได้)</span></h2>
          {pro && <span className="hint">พร้อมแล้ว <b className="num">{extraDone}/3</b></span>}
        </div>
        <div className="adv-opts static">
          <div><b>ลิงก์อัตโนมัติทุกตัว</b><span>ระบบสร้างลิงก์ของคุณให้ Top 20 ทุกหมวด ไม่ต้องกดแชร์ทีละตัว</span></div>
          <div><b>สแกนหมวดที่คุณทำเอง</b><span>พิมพ์คำค้นอะไรก็ได้ ระบบดึงสินค้าและจัดอันดับให้</span></div>
        </div>
        <p className="need"><b>ต้องใช้:</b> คอม + Chrome + ล็อกอิน Shopee Affiliate · ทำครั้งเดียวราว 3 นาที{pro ? "" : " · สำหรับแพ็ก Pro"}</p>
        {pro ? (
          <ol className="st-list">
            <Item state={extOk || linkedName ? "ok" : "off"} title="1. ติดตั้ง Connector ใน Chrome"
              detail={extOk ? "ติดตั้งในเบราว์เซอร์นี้แล้ว" : linkedName ? (mobile() ? "ติดตั้งบนคอมแล้ว" : "ติดตั้งบนคอมเครื่องอื่นแล้ว เครื่องนี้ยังไม่ได้ติดตั้ง") : mobile() ? "เปิดหน้านี้บนคอมเพื่อติดตั้ง" : "ส่วนเสริม Chrome ที่อ่านข้อมูลจาก Shopee Affiliate ที่คุณล็อกอินไว้ ไม่เก็บรหัสผ่าน"}>
              {!extOk && !mobile() && <a className="btn primary" href="/connector" target="_blank" rel="noopener">วิธีติดตั้ง</a>}
            </Item>
            <Item state={shopee || remoteLive ? "ok" : linkedName ? "info" : "off"} title="2. ล็อกอิน Shopee Affiliate"
              detail={shopee ? `ล็อกอินอยู่: ${shopee}` : remoteLive ? `ล็อกอินอยู่บนคอม: ${linkedName} · เช็กล่าสุด ${agoTxt(seenAt)}` : linkedName ? `บัญชีที่เคยเชื่อม: ${linkedName} · ${extOk ? "ตอนนี้ไม่ได้ล็อกอินในเบราว์เซอร์นี้" : seenAt ? "บนคอมหลุดจาก Shopee อยู่" : "เปิดปั๊กปักบนคอมสักครั้งเพื่ออัปเดตสถานะ"} · ลิงก์เดิมยังใช้ได้` : "ล็อกอินใน Chrome เครื่องเดียวกับที่ติดตั้ง Connector ระบบจะรู้เอง"}>
              {!shopee && extOk && <a className="btn" href="/">ไปเชื่อม Shopee</a>}
            </Item>
            <Item state={products.length ? "ok" : "off"} title="3. สแกนหมวดแรก"
              detail={products.length ? `${products.length} สินค้า · ${cats.length} หมวด · ลิงก์อัตโนมัติ ${links} อัน · อัปเดตล่าสุด ${thDate(newest)}` : "กดหมวดหรือพิมพ์คำค้นในหน้าแรก ระบบสร้างลิงก์ Top 20 ให้ทันที"} />
          </ol>
        ) : (
          <div className="bar"><a className="btn primary" href={UPGRADE_URL} target="_blank" rel="noopener">อัปเกรด Pro เพื่อเปิดขั้นสูง</a></div>
        )}
      </section>

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
