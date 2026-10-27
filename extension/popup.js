const st = document.getElementById("st"), txt = document.getElementById("txt"), btn = document.getElementById("login");
btn.onclick = () => chrome.runtime.sendMessage({ type: "openLogin" });
chrome.runtime.sendMessage({ type: "status" }, (r) => {
  if (r && r.loggedIn) { st.classList.add("ok"); txt.textContent = "เชื่อมแล้ว: " + r.name; }
  else { txt.textContent = r && r.tab ? "ยังไม่ได้ล็อกอิน Shopee Affiliate" : "ยังไม่ได้เปิด Shopee Affiliate"; btn.hidden = false; }
});
