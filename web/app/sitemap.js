import { GUIDES } from "../lib/guides";
const SITE = process.env.APP_URL || "https://pugpak.com";
export default function sitemap() {
  return [
    { url: `${SITE}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/guide`, changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map((g) => ({ url: `${SITE}/guide/${g.slug}`, lastModified: new Date(g.updated), changeFrequency: "monthly", priority: 0.8 })),
    { url: `${SITE}/connector`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
