import { GUIDES, nb } from "../../lib/guides";

export const metadata = {
  title: "คู่มือ Shopee Affiliate สำหรับคนทำคลิปปักตะกร้า",
  description: "คู่มือ Shopee Affiliate ภาษาไทย: ค่าคอมคิดยังไง จ่ายเมื่อไหร่ เลือกสินค้าปักตะกร้ายังไงให้ขายได้ และหา Affiliate ID",
  alternates: { canonical: "/guide" },
};

export default function GuideIndex() {
  return (
    <main className="gd"><div className="gd-in">
      <nav className="gd-crumb"><a href="/">ปั๊กปัก</a></nav>
      <h1>คู่มือ Shopee Affiliate สำหรับคนทำคลิป</h1>
      <ul className="gd-list">
        {GUIDES.map((g) => <li key={g.slug}><a href={`/guide/${g.slug}`}><img src={`/guide-img/${g.slug}.webp`} alt={g.alt} width="1344" height="768" loading="lazy" /><div><b>{nb(g.title)}</b><span>{g.description}</span></div></a></li>)}
      </ul>
    </div></main>
  );
}
