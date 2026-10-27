# ปั๊กปัก

ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น

- `extension/` — ปั๊กปัก Connector (Chrome MV3) อ่านข้อมูลจากแท็บ Shopee Affiliate ที่ผู้ใช้ล็อกอินไว้: เช็คบัญชี, ค้นสินค้า, สร้างลิงก์พร้อม Sub ID
- `web/` — Next.js app (deploy บน Vercel): เชื่อม Connector → ดึงสินค้า → data score + AI score → Top 10 → สร้างลิงก์

## รันในเครื่อง
1. `chrome://extensions` → Developer mode → Load unpacked → เลือก `extension/`
2. `cd web && cp .env.example .env.local` แล้วใส่ `ANTHROPIC_API_KEY`
3. `npm install && npm run dev` แล้วเปิด http://localhost:3000

## Deploy
- Vercel: root = `web/`, ตั้ง env `ANTHROPIC_API_KEY`
- ถ้าใช้โดเมนของตัวเอง ให้เพิ่มโดเมนใน `externally_connectable.matches` ของ `extension/manifest.json`

## Sync ข้ามอุปกรณ์
- แต่ละบัญชีคือ sync key แบบสุ่มที่สร้างใน browser (เก็บบน server เป็นค่า hash) ข้อมูลอยู่ใน Vercel Blob แบบ private (`users/<hash>.json`)
- ปุ่ม "เปิดบนมือถือ" สร้างรหัส 6 หลัก/QR อายุ 10 นาที ใช้ได้ครั้งเดียว (`/api/pair`)
- AI ให้คะแนนทีละสินค้า (`/api/score`) และเก็บผลไว้ที่ `ai/<shopId_itemId>.json` ใช้ร่วมกันทุกบัญชี สินค้าที่เคยมีคนให้คะแนนแล้วไม่เสียค่า AI ซ้ำ
- ต้องมี env `BLOB_READ_WRITE_TOKEN` (ผูก Blob store กับ project) และ `ANTHROPIC_API_KEY`
