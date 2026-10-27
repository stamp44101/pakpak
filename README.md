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

## สมาชิก (Early Access)
- เข้าสู่ระบบด้วย LINE Login (`/api/auth/line` → `/api/auth/line/callback`) session เป็น cookie ที่เซ็นด้วย HMAC
- สมาชิกเก็บใน Blob `members/<lineUserId>.json` และรายชื่อใน `meta/roster.json` ได้สิทธิ์ทันทีถ้ายังไม่เต็ม `EARLY_ACCESS_SEATS` (ค่าเริ่ม 10) ถ้าเต็มจะเข้าคิว
- คนแรกที่เข้าสู่ระบบเป็น admin ใช้หน้า `/admin` เปิดสิทธิ์ ย้ายคิว หรือระงับ
- ข้อมูลของแต่ละคนอยู่ที่ `users/m_<lineUserId>.json` เปิดจากคอมหรือมือถือก็เห็นเหมือนกัน
- AI ให้คะแนนทีละสินค้า เก็บผลรวมที่ `ai/<shopId_itemId>.json` ใช้ร่วมกันทุกคน สินค้าที่เคยให้คะแนนแล้วไม่เสียค่า AI และไม่นับโควต้า (`AI_DAILY_LIMIT` ค่าเริ่ม 30 ตัวต่อคนต่อวัน)

## Env
`LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `APP_URL`, `EARLY_ACCESS_SEATS`, `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`
