const SITE = process.env.APP_URL || "https://pakpak-two.vercel.app";
export default function sitemap() {
  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/connector`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
