import "./globals.css";

export const metadata = { title: "ปั๊กปัก", description: "ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น" };

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;700&family=Mitr:wght@500;600&family=IBM+Plex+Sans+Thai:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
