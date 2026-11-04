import { notFound } from "next/navigation";
import { GUIDES, guideBySlug } from "../../../lib/guides";

const SITE = process.env.APP_URL || "https://pugpak.com";
const thDate = (d) => new Date(d + "T00:00:00+07:00").toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

export const dynamicParams = false;
export function generateStaticParams() { return GUIDES.map((g) => ({ slug: g.slug })); }

export function generateMetadata({ params }) {
  const g = guideBySlug(params.slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guide/${g.slug}` },
    openGraph: { type: "article", url: `/guide/${g.slug}`, title: g.title, description: g.description, modifiedTime: g.updated, images: [{ url: `/guide-img/${g.slug}-og.jpg`, width: 1200, height: 630, alt: g.alt }] },
    twitter: { card: "summary_large_image", title: g.title, description: g.description, images: [`/guide-img/${g.slug}-og.jpg`] },
  };
}

function Block({ type, v }) {
  if (type === "ul") return <ul>{v.map((x) => <li key={x}>{x}</li>)}</ul>;
  if (type === "ol") return <ol>{v.map((x) => <li key={x}>{x}</li>)}</ol>;
  if (type === "note") return <p className="gd-note">{v}</p>;
  return <p>{v}</p>;
}

export default function Guide({ params }) {
  const g = guideBySlug(params.slug);
  if (!g) notFound();
  const url = `${SITE}/guide/${g.slug}`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: g.title, description: g.description, inLanguage: "th", dateModified: g.updated, datePublished: g.updated, mainEntityOfPage: url, author: { "@id": `${SITE}/#org` }, publisher: { "@id": `${SITE}/#org` }, image: `${SITE}/guide-img/${g.slug}-og.jpg` },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "ปั๊กปัก", item: SITE },
        { "@type": "ListItem", position: 2, name: "คู่มือ", item: `${SITE}/guide` },
        { "@type": "ListItem", position: 3, name: g.title, item: url },
      ] },
      ...(g.faq?.length ? [{ "@type": "FAQPage", mainEntity: g.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] : []),
    ],
  };
  const related = (g.related || []).map(guideBySlug).filter(Boolean);
  return (
    <main className="gd"><div className="gd-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav className="gd-crumb"><a href="/">ปั๊กปัก</a> / <a href="/guide">คู่มือ</a></nav>
      <h1>{g.title}</h1>
      <p className="gd-date">อัปเดต {thDate(g.updated)}</p>
      <img className="gd-hero" src={`/guide-img/${g.slug}.webp`} alt={g.alt} width="1344" height="768" />
      <p className="gd-answer">{g.answer}</p>
      {g.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.blocks.map((b, i) => <Block key={i} type={b[0]} v={b[1]} />)}
        </section>
      ))}
      {g.faq?.length > 0 && (
        <section>
          <h2>คำถามที่เจอบ่อย</h2>
          {g.faq.map(({ q, a }) => <div key={q} className="gd-faq"><h3>{q}</h3><p>{a}</p></div>)}
        </section>
      )}
      <aside className="gd-cta">
        <b>ไม่อยากไล่ดูทีละชิ้น?</b>
        <p>ปั๊กปักจัดอันดับตะกร้า Shopee ทุกหมวดให้ พร้อมไอเดีย hook 3 วิแรก ใช้ฟรีในแชท LINE</p>
        <a href="/">ดูปั๊กปัก</a>
      </aside>
      {related.length > 0 && (
        <section className="gd-related">
          <h2>อ่านต่อ</h2>
          <ul>{related.map((r) => <li key={r.slug}><a href={`/guide/${r.slug}`}>{r.title}</a></li>)}</ul>
        </section>
      )}
      {g.sources?.length > 0 && (
        <p className="gd-src">ที่มา: {g.sources.map((s, i) => <span key={s.url}>{i > 0 && " · "}<a href={s.url} rel="nofollow noopener" target="_blank">{s.name}</a></span>)}</p>
      )}
    </div></main>
  );
}
