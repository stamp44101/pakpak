# ปั๊กปัก

ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น

- `extension/` — ปั๊กปัก Connector (Chrome MV3) อ่านข้อมูลจากแท็บ Shopee Affiliate ที่ผู้ใช้ล็อกอินไว้: เช็คบัญชี, ค้นสินค้า, สร้างลิงก์พร้อม Sub ID
- `web/` — Next.js app (deploy บน Vercel): เชื่อม Connector → ดึงสินค้า → data score + AI score → Top 10 → สร้างลิงก์ → ผล A/B

## รันในเครื่อง
1. `chrome://extensions` → Developer mode → Load unpacked → เลือก `extension/`
2. `cd web && cp .env.example .env.local` แล้วใส่ `ANTHROPIC_API_KEY`
3. `npm install && npm run dev` แล้วเปิด http://localhost:3000

## Deploy
- Vercel: root = `web/`, ตั้ง env `ANTHROPIC_API_KEY`
- ถ้าใช้โดเมนของตัวเอง ให้เพิ่มโดเมนใน `externally_connectable.matches` ของ `extension/manifest.json`
