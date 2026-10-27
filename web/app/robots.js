const SITE = process.env.APP_URL || "https://pakpak-two.vercel.app";
export default function robots() {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/landing"] }], sitemap: `${SITE}/sitemap.xml`, host: SITE };
}
