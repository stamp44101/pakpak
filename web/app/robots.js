const SITE = process.env.APP_URL || "https://pugpak.com";
export default function robots() {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/landing"] }], sitemap: `${SITE}/sitemap.xml`, host: SITE };
}
