// Thai text formatting shared by the bot and server routes.
export const baht = (n) => "฿" + Math.round(+n || 0).toLocaleString("en-US");
export const thDate = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
export const ago = (t) => { const h = (Date.now() - t) / 3600e3; return h < 1 ? "ไม่ถึงชั่วโมงก่อน" : h < 24 ? `${Math.floor(h)} ชม.ก่อน` : `${Math.floor(h / 24)} วันก่อน`; };
// Date + time in Bangkok time, e.g. "31 ต.ค. 12:30" (server runs in UTC).
export const thDateTime = (t) => new Date(t).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(" เวลา", "") + " น.";
