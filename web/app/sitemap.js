const SITE = process.env.APP_URL || "https://pugpak.com";
export default function sitemap() {
  return [
    { url: `${SITE}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/connector`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
