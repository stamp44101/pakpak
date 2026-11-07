"use client";
// "สรุปก่อน 11.11": tier list of baskets. Full for Pro / ฿69 buyers; everyone else sees a locked teaser (counts only).
import { useEffect, useState } from "react";

const BUY_URL = "https://line.me/R/oaMessage/@979soyth/?" + encodeURIComponent("สรุป 11.11");
const nf = (n) => Number(n).toLocaleString("en-US");
const kf = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));
const bf = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);
const clean = (s) => (s || "").replace(/^\s*[\[【][^\]】]{0,40}[\]】]\s*/, "").trim() || s;
const img = (id) => (id ? `https://down-th.img.susercontent.com/file/${id}_tn` : "");

const META = {
  S: { l: "S", t: "ปักก่อนใคร", d: "ได้ ≥฿20/ออเดอร์ · ขาย ≥2k/เดือน · ★4.8+ · ยอด 30 วันสูงเทียบยอดสะสม" },
  A: { l: "A", t: "ปักได้เลย", d: "ได้ ≥฿10/ออเดอร์ · ขาย ≥1k/เดือน · ★4.7+" },
  B: { l: "B", t: "ปักถ้ามีมุมคลิป", d: "ได้ ≥฿5/ออเดอร์ · ขาย ≥500/เดือน" },
  H: { l: "฿฿", t: "ของแพง ปิดยาก", d: "ราคาเกิน ฿5,000 ได้เงินต่อชิ้นสูง แต่คนตัดสินใจซื้อช้า" },
  C: { l: "C", t: "ที่เหลือ ปักเมื่อว่าง", d: "ไม่ลงรายการในฉบับนี้" },
  D: { l: "D", t: "ห้ามปัก", d: "ยอดสวยแต่ได้ต่ำกว่า ฿2/ออเดอร์ · หรือรีวิวต่ำกว่า ★4.6 · หรือคอมเพิ่งลด" },
  U: { l: "↑", t: "คอมเพิ่งขึ้น", d: "คอมมิชชันขึ้นในรอบ 14 วันล่าสุด" },
};

function why(x, k) {
  const a = [];
  if (k === "D") {
    if (x.perOrder < 2) a.push(`ยอดสวย (${kf(x.sold)}/เดือน) แต่ได้แค่ ~฿${bf(x.perOrder)}/ออเดอร์`);
    if (x.rating > 0 && x.rating < 4.6) a.push(`คะแนนรีวิวต่ำ ★${x.rating.toFixed(2)}`);
    if (x.ch && x.ch.to < x.ch.from) a.push(`คอมเพิ่งลด ${Math.round(x.ch.from)}→${Math.round(x.ch.to)}%`);
    return (a.length ? a : [`ได้ ~฿${bf(x.perOrder)}/ออเดอร์`]).join(" · ");
  }
  a.push(`฿${nf(x.price)} × ${x.commission}%`, `ขาย ${kf(x.sold)}/เดือน`);
  if (x.share >= 95) a.push("สินค้าใหม่ ยอดเกือบทั้งหมดมาจาก 30 วันนี้");
  else if (x.share >= 20) a.push(`ยอด 30 วันเท่ากับ ${x.share}% ของยอดสะสม`);
  if (x.ch) a.push(`คอม${x.ch.to > x.ch.from ? "ขึ้น" : "ลด"} ${Math.round(x.ch.from)}→${Math.round(x.ch.to)}%`);
  if (x.rating) a.push(`★${x.rating.toFixed(2)}`);
  return a.join(" · ");
}

export default function Report() {
  const [d, setD] = useState(null);
  const [tier, setTier] = useState("S");
  const [cat, setCat] = useState("ทั้งหมด");

  useEffect(() => {
    fetch("/api/report", { credentials: "same-origin" }).then(async (r) => (r.status === 401 ? { login: true } : r.ok ? r.json() : { error: true })).then(setD).catch(() => setD({ error: true }));
  }, []);

  if (!d) return <div className="wrap rp"><p className="hint">กำลังโหลด…</p></div>;
  if (d.login) return <div className="wrap rp"><h1>สรุปก่อน 11.11</h1><p className="hint">เข้าสู่ระบบก่อนนะคะ</p><div className="bar"><a className="btn primary" href="/api/auth/line">เข้าสู่ระบบด้วย LINE</a></div></div>;
  if (d.error) return <div className="wrap rp"><h1>สรุปก่อน 11.11</h1><p className="hint">โหลดไม่สำเร็จ ลองใหม่อีกครั้ง</p></div>;

  const when = new Date(d.gen).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const c = d.counts;

  if (d.locked) return (
    <div className="wrap rp">
      <header><div className="rp-eyebrow">รายงานพิเศษ</div><h1>สรุปก่อน 11.11</h1><p className="sub">Tier list จาก {nf(d.total)} ตะกร้าในคลังกลาง · ดึงเมื่อ {when} น.</p></header>
      <section className="rp-board">
        {["S", "A", "B", "H", "D", "U"].map((k) => (
          <div key={k} className="rp-row static"><div className={"rp-tier t-" + (k === "H" ? "H" : k === "U" ? "U" : k)}>{META[k].l}</div><div className="rp-what"><strong>{META[k].t}</strong><span>{META[k].d}</span></div><div className="rp-cnt num">{c[k]}</div></div>
        ))}
      </section>
      <section className="panel">
        <h2>ปลดล็อกรายงานฉบับเต็ม</h2>
        <p className="hint">เห็นชื่อ รูป ค่าคอมต่อออเดอร์ และเหตุผลของทุกตะกร้าใน S / A / B / ของแพง / ห้ามปัก / คอมเพิ่งขึ้น{d.cats?.length ? ` · หมวดที่เจอบ่อยใน S: ${d.cats.join(" · ")}` : ""}</p>
        <div className="bar"><b className="num rp-price">฿{d.price}</b><span className="hint">ครั้งเดียว · สมาชิก Pro ดูฟรี</span></div>
        <div className="bar"><a className="btn primary" href={BUY_URL}>{d.pending ? "รอแอดมินตรวจสลิป · เปิดแชท LINE" : `ซื้อใน LINE ฿${d.price}`}</a></div>
      </section>
    </div>
  );

  const items = d.tiers[tier] || [];
  const cats = ["ทั้งหมด", ...Array.from(new Set(items.map((x) => x.category).filter(Boolean)))];
  const shown = items.filter((x) => cat === "ทั้งหมด" || x.category === cat);
  const topMoney = d.money[0];
  const sCats = Object.entries(d.tiers.S.reduce((a, x) => ((a[x.category] = (a[x.category] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n})`).join(" · ");
  const pick = (k) => { setTier(k); setCat("ทั้งหมด"); };
  const row = (k, n, note) => (
    <button key={k} type="button" className="rp-row" aria-pressed={tier === k} onClick={() => pick(k)}>
      <div className={"rp-tier t-" + k}>{META[k].l}</div><div className="rp-what"><strong>{META[k].t}</strong><span>{META[k].d}</span></div>
      <div className="rp-cnt num">{n}{note && <small>{note}</small>}</div>
    </button>
  );

  return (
    <div className="wrap rp">
      <header><div className="rp-eyebrow">รายงานพิเศษ</div><h1>สรุปก่อน 11.11</h1><p className="sub">ข้อมูลจากคลังกลางปั๊กปัก {nf(d.total)} ตะกร้า · ดึงเมื่อ {when} น.</p></header>

      <section className="rp-brief">
        <div><b>ปักอะไร</b><p>{c.S} ตัวใน S ได้เงินดีและขายติดทั้งเดือน หมวดที่เจอบ่อยที่สุดคือ {sCats || "-"}</p></div>
        <div><b>ห้ามปักอะไร</b><p>มี {nf(c.D)} ตะกร้าที่ยอดดูสวยแต่ได้ไม่ถึง ฿2 ต่อออเดอร์ หรือรีวิวต่ำ ในหน้านี้แสดง {d.tiers.D.length} ตัวที่ยอดสูงสุด</p></div>
        {topMoney && <div><b>เงินต่อชิ้น</b><p>สูงสุดในกลุ่มราคาไม่เกิน ฿5,000 คือ <span className="num">฿{bf(topMoney.perOrder)}</span> ต่อออเดอร์ ({clean(topMoney.name).replace(/…$/, "")})</p></div>}
      </section>

      <section>
        <h2>Tier list ตะกร้า</h2>
        <div className="rp-board">
          {["S", "A", "B", "H"].map((k) => row(k, c[k]))}
          <div className="rp-row static"><div className="rp-tier t-C">C</div><div className="rp-what"><strong>{META.C.t}</strong><span>{META.C.d}</span></div><div className="rp-cnt num">~{nf(c.C)}</div></div>
          {row("D", d.tiers.D.length, `จาก ${nf(c.D)}`)}
          {row("U", d.tiers.U.length)}
        </div>
      </section>

      <section id="rp-list">
        <h2>{tier === "H" ? "ของแพง" : tier === "U" ? "คอมเพิ่งขึ้น" : "Tier " + META[tier].l} · {META[tier].t}</h2>
        <p className="hint">{META[tier].d}{tier === "D" ? ` · แสดง ${items.length} ตัวที่ยอดสูงสุด จากทั้งหมด ${nf(c.D)}` : ""}</p>
        <div className="bar" role="group" aria-label="กรองตามหมวด" style={{ margin: "10px 0" }}>
          {cats.map((x) => <button key={x} type="button" className={"chip" + (cat === x ? " on" : "")} aria-pressed={cat === x} onClick={() => setCat(x)}>{x}</button>)}
        </div>
        <div className="rp-cards">
          {shown.length === 0 && <p className="hint">ไม่มีตะกร้าในหมวดนี้</p>}
          {shown.map((x) => (
            <article key={x.id} className="rp-card">
              {x.image ? <img className="rp-thumb" src={img(x.image)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="rp-thumb" />}
              <div className={"rp-money t-" + tier}><b className="num">฿{nf(bf(x.perOrder))}</b><span>ต่อออเดอร์</span></div>
              <div className="rp-body">
                <div className="rp-name">{clean(x.name)}</div>
                <div className="rp-why num">{why(x, tier)}</div>
                <div className="rp-foot"><span className="tag">{x.category}</span>{x.url && <a className="btn" href={x.url} target="_blank" rel="noopener noreferrer">ดูใน Shopee</a>}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>เงินต่อออเดอร์สูงสุด</h2>
        <p className="hint">จาก S, A และ B ไม่รวมสินค้าราคาเกิน ฿5,000</p>
        <div className="rp-tablewrap"><table className="rp-table">
          <thead><tr><th>สินค้า</th><th className="r">ราคา</th><th className="r">คอม</th><th className="r">ได้/ออเดอร์</th></tr></thead>
          <tbody>{d.money.map((x) => <tr key={x.id}><td>{clean(x.name)}</td><td className="r num">฿{nf(x.price)}</td><td className="r num">{x.commission}%</td><td className="r num"><b>฿{nf(bf(x.perOrder))}</b></td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}
