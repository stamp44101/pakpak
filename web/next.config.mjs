// Response headers for every page and API route (security review 19 Nov 2026).
// - nosniff: browsers must not guess a file's type
// - frame headers: ปั๊กปัก may not be shown inside another site's frame (LIFF opens it in LINE's own browser, not a frame)
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      ],
    }];
  },
};

export default nextConfig;
