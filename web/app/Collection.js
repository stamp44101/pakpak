"use client";
// Trend Alert collection (lib/collections.js), opened from LINE cards via /?c=<slug> or ?src=line_…
// Pro: every product with its own-link button. Free: outline + upgrade (the server sends nothing else).
import { useEffect, useState } from "react";
import AffLinkBox from "./AffLinkBox";

const UPGRADE_URL = "https://line.me/R/oaMessage/@979soyth/?" + encodeURIComponent("อัปเกรด Pro");
const img = (id) => `https://down-th.img.susercontent.com/file/${id}_tn`;

export default function Collection({ slug, say, onClose }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    fetch("/api/collection?slug=" + encodeURIComponent(slug), { credentials: "same-origin" })
      .then((r) => r.json()).catch(() => ({ error: "โหลดไม่สำเร็จ" })).then(setC);
  }, [slug]);
  useEffect(() => { if (c && !c.error) document.getElementById("collection")?.scrollIntoView({ block: "start" }); }, [c]);

  if (!c) return <section className="panel" id="collection"><p className="hint" style={{ margin: 0 }}>กำลังโหลดคอลเลกชัน…</p></section>;
  if (c.error) return <section className="panel" id="collection"><p className="hint" style={{ margin: 0 }}>{c.error}</p></section>;

  return (
    <section className="panel" id="collection">
      <div className="bar" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}>
        <span className="eyebrow" style={{ minWidth: 0 }}>💎 Insight Pro · Trend Alert</span>
        <button className="btn ghost" onClick={onClose}>ปิด</button>
      </div>
      <h2>{c.title} · {c.count} ตะกร้า</h2>
      <p className="hint">อัปเดต {c.updated} · ราคา/ค่าคอมเปลี่ยนได้ เช็กก่อนปักทุกครั้ง</p>
      {c.pro ? <>
        {c.note && <p className="hint">🎬 {c.note}</p>}
        {c.groups.map((g) => (
          <div key={g.name} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            <h3 style={{ margin: 0 }}>{g.name}</h3>
            {g.items.map((p) => (
              <div key={p.id} className="row coll-row">
                <a href={p.url} target="_blank" rel="noopener"><img className="thumb" src={img(p.image)} alt="" loading="lazy" referrerPolicy="no-referrer" /></a>
                <div className="coll-body">
                  {p.badge && <span className="tag a coll-badge">{p.badge}</span>}
                  <div className="coll-name"><b>{p.no}</b> {p.name}</div>
                  <div className="coll-stats">
                    <span>฿{p.price.toLocaleString()}</span>
                    <span>ขาย {p.sold}/เดือน</span>
                    <span>คอม {p.commission}%</span>
                    <b className="coll-per">≈ ฿{Math.round(p.price * p.commission / 100).toLocaleString()}/ออเดอร์</b>
                  </div>
                  <div className="bar"><AffLinkBox url={p.url} say={say} /><a className="btn ghost" href={p.url} target="_blank" rel="noopener">ดูใน Shopee</a></div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </> : <>
        {c.groups.map((g) => <p key={g.name} className="hint" style={{ margin: "4px 0" }}>🔒 {g.name} · {g.n} ตะกร้า</p>)}
        <p className="hint">รายชื่อตะกร้า ราคา ค่าคอม และปุ่มเอาลิงก์ของคุณ เปิดให้สมาชิก Pro เท่านั้นค่ะ</p>
        <div className="bar"><a className="btn primary" href={UPGRADE_URL} target="_blank" rel="noopener">🔒 อัป Pro ดู Insight เต็ม</a></div>
      </>}
    </section>
  );
}
