import "./globals.css";

const SITE = process.env.APP_URL || "https://pakpak-two.vercel.app";
const TITLE = "ปั๊กปัก — รู้ก่อนถ่าย ว่าตะกร้าไหนขายได้";
const DESC = "เครื่องมือเลือกตะกร้า Shopee Affiliate สำหรับคนทำคลิปปักตะกร้า จัดอันดับจากยอดขาย ค่าคอม รีวิว ให้ AI บอก hook 3 วิแรก และก๊อปลิงก์ได้ในแชท LINE";

export const fetchCache = "force-no-store";
export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s · ปั๊กปัก" },
  description: DESC,
  applicationName: "ปั๊กปัก",
  keywords: ["Shopee Affiliate", "ปักตะกร้า", "นายหน้า Shopee", "หาสินค้าทำคลิป", "affiliate ลิงก์", "คลิปขายของ", "TikTok", "Reels", "AI hook"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "th_TH", url: "/", siteName: "ปั๊กปัก", title: TITLE, description: DESC,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "ปั๊กปัก จัดอันดับตะกร้า Shopee ที่ทำคลิปแล้วขายได้" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.jpg"] },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};
export const viewport = { themeColor: "#FF6A13", width: "device-width", initialScale: 1 };

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ปั๊กปัก",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, LINE",
  url: SITE,
  image: `${SITE}/og.jpg`,
  description: DESC,
  inLanguage: "th",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "THB" },
    { "@type": "Offer", name: "Pro", price: "199", priceCurrency: "THB", priceSpecification: { "@type": "UnitPriceSpecification", price: "199", priceCurrency: "THB", billingDuration: "P1M" } },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;700&family=Mitr:wght@500;600&family=IBM+Plex+Sans+Thai:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
