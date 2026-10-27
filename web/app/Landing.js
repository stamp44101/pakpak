"use client";
// Public landing page for people who are not signed in (also previewable at /landing).

const LOGIN = "/api/auth/line";

function Glyph({ kind }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "pan") return <svg viewBox="0 0 48 48" {...p}><circle cx="20" cy="26" r="12" /><path d="M32 26h12" /><path d="M14 22c2-3 6-4 9-2" /></svg>;
  if (kind === "cat") return <svg viewBox="0 0 48 48" {...p}><path d="M10 40V18l7 6h14l7-6v22z" /><circle cx="19" cy="31" r="1.5" /><circle cx="29" cy="31" r="1.5" /></svg>;
  return <svg viewBox="0 0 48 48" {...p}><rect x="17" y="18" width="14" height="22" rx="3" /><path d="M20 18v-6l8-4v10" /></svg>;
}

function Card({ n, score, name, price, glyph, tone }) {
  return (
    <div className="lp-card" style={{ "--tone": tone }}>
      <div className="lp-card-img"><Glyph kind={glyph} /></div>
      <div className="lp-card-body">
        <div className="lp-card-top"><b>#{n}</b><span>คะแนน {score}/100</span></div>
        <p className="lp-card-name">{name}</p>
        <p className="lp-card-meta">{price}</p>
        <span className="lp-card-btn">คัดลอกลิงก์</span>
        <span className="lp-card-link">ให้ AI ดู</span>
      </div>
    </div>
  );
}

function Phone() {
  return (
    <div className="lp-phone" aria-label="ตัวอย่างการใช้ปั๊กปักในแชท LINE">
      <div className="lp-phone-bar"><img src="/logo.svg" alt="" width="26" height="26" /><b>ปั๊กปัก</b></div>
      <div className="lp-chat">
        <p className="lp-me">ท็อป ห้องครัว</p>
        <p className="lp-bot">ท็อป 5 หมวด “ห้องครัว” · ข้อมูลเมื่อ 2 ชม.ก่อน</p>
        <div className="lp-carousel">
          <Card n={1} score={82} glyph="pan" tone="#FFE1CC" name="แผ่นรองหม้อทอดไร้น้ำมัน ซิลิโคน" price="฿99 · คอม 10% · ได้ ~฿10/ออเดอร์" />
          <Card n={2} score={77} glyph="spray" tone="#FFD9E2" name="สเปรย์ขจัดคราบมันเตาแก๊ส" price="฿159 · คอม 9% · ได้ ~฿14/ออเดอร์" />
          <Card n={3} score={71} glyph="cat" tone="#DDEBFF" name="กล่องเก็บอาหารสุญญากาศ" price="฿189 · คอม 12% · ได้ ~฿23/ออเดอร์" />
        </div>
        <p className="lp-bot lp-hook"><b>Hook 3 วิแรก</b><br />“หม้อทอดเลอะทุกครั้งที่ใช้? แผ่นเดียวจบ ล้างแค่ 5 วิ”</p>
      </div>
    </div>
  );
}

function Cta({ me, onLogin, big }) {
  const left = me?.left ?? null;
  return (
    <div className={"lp-cta" + (big ? " big" : "")}>
      <a className="lp-line" href={LOGIN} onClick={onLogin}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6c1.4-1.6 2-3.2 2-4.8C22 6.6 17.5 3 12 3z" /></svg>
        สมัครด้วย LINE
      </a>
      {left !== null && (
        <p className="lp-seats">
          {left > 0 ? <>Early Access เหลือ <b>{left}</b> จาก {me.seats} ที่ สมัครแล้วใช้ได้ทันที</> : <>Early Access เต็มแล้ว สมัครไว้เพื่อเข้าคิว เราจะเปิดสิทธิ์ให้ตามลำดับ</>}
        </p>
      )}
    </div>
  );
}

export default function Landing({ me, onLogin }) {
  return (
    <div className="lp">
      <header className="lp-nav">
        <a href="/" className="lp-logo"><img src="/wordmark.svg" alt="ปั๊กปัก" height="34" /></a>
        <a className="lp-nav-login" href={LOGIN} onClick={onLogin}>เข้าสู่ระบบ</a>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <h1>รู้ก่อนถ่าย<br />ว่าตะกร้าไหน<br />ขายได้</h1>
          <p className="lp-lead">ปั๊กปักดึงสินค้าจาก Shopee Affiliate ของคุณ จัดอันดับจากยอดขาย ค่าคอม และรีวิว แล้วให้ AI บอกว่าตัวไหนทำคลิปง่าย พร้อม hook 3 วินาทีแรก ใช้ต่อในแชท LINE ได้เลย</p>
          <Cta me={me} onLogin={onLogin} />
        </div>
        <Phone />
      </section>

      <section className="lp-pain">
        <p>ถ่ายมา 10 คลิป ขายได้คลิปเดียว<br /><span>ปัญหามักไม่ใช่ฝีมือถ่าย แต่เป็นตะกร้าที่เลือกตั้งแต่แรก</span></p>
      </section>

      <section className="lp-steps">
        <h2>ใช้ยังไง</h2>
        <ol>
          <li><b>ติดตั้ง Connector บนคอม</b><span>ส่วนเสริม Chrome อ่านข้อมูลจาก Shopee Affiliate ที่คุณล็อกอินไว้ ไม่เก็บรหัสผ่าน</span></li>
          <li><b>กดหมวดที่อยากทำ</b><span>ห้องครัว ความงาม สัตว์เลี้ยง หรือพิมพ์คำค้นเอง ระบบจัดอันดับและสร้างลิงก์ Top 20 ให้ทันที</span></li>
          <li><b>หยิบจากมือถือแล้วไปถ่าย</b><span>พิมพ์ “ท็อป” ในแชท LINE ก๊อปลิงก์ไปปักตะกร้า กด “ให้ AI ดู” เพื่อเอามุมเล่าคลิป</span></li>
        </ol>
      </section>

      <section className="lp-score">
        <div>
          <h2>คะแนนเต็ม 100 มาจากไหน</h2>
          <p>ตัวเลขจาก Shopee บอกว่าของขายได้ไหม ส่วน AI บอกว่าเล่าเป็นคลิปได้ไหม ต้องผ่านทั้งสองอย่าง</p>
        </div>
        <div className="lp-meter">
          {[["ข้อมูลจาก Shopee", 60, "data", [["ยอดขาย", 20], ["ค่าคอม", 15], ["รีวิวและเรตติ้ง", 10], ["ราคาช่วงซื้อง่าย", 10], ["ประเภทร้าน", 5]]],
            ["AI ประเมินคลิป", 40, "ai", [["โชว์ปัญหาได้ใน 3 วิ", 15], ["ภาพหยุดนิ้ว", 15], ["เล่าได้หลายคลิป", 10]]]].map(([title, total, k, rows]) => (
            <div key={k} className={"lp-group " + k}>
              <div className="lp-group-head"><b>{title}</b><span>{total} คะแนน</span></div>
              {rows.map(([label, w]) => (
                <div key={label} className="lp-bar"><span>{label}</span><i style={{ width: `${(w / 20) * 100}%` }} /><em>{w}</em></div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="lp-line-sec">
        <img src="/richmenu.png" alt="เมนูปั๊กปักใน LINE: ท็อป 5 วันนี้ เลือกหมวด ลิงก์ของฉัน เปิดปั๊กปัก วิธีใช้ ติดต่อแอดมิน" loading="lazy" />
        <div>
          <h2>อยู่ในแชท LINE ที่คุณเปิดทุกวัน</h2>
          <p>ไม่ต้องเปิดคอมก็หยิบตะกร้าได้ เมนูด้านล่างแชทกดครั้งเดียวได้ท็อป 5 ลิงก์ของคุณ และไอเดียคลิปจาก AI</p>
        </div>
      </section>

      <section className="lp-faq">
        <h2>คำถามที่เจอบ่อย</h2>
        <details><summary>ปั๊กปักเห็นรหัสผ่าน Shopee ของฉันไหม</summary><p>ไม่เห็น คุณล็อกอิน Shopee Affiliate เองใน Chrome ตามปกติ Connector แค่อ่านรายการสินค้าและสร้างลิงก์จากแท็บนั้น ไม่เก็บรหัสผ่านหรือ cookie</p></details>
        <details><summary>ใช้แต่มือถือได้ไหม</summary><p>ดูอันดับ ก๊อปลิงก์ และขอไอเดียคลิปจากแชท LINE ได้บนมือถือ ส่วนการสแกนหมวดใหม่ต้องทำบนคอมที่มี Chrome</p></details>
        <details><summary>ลิงก์ที่ได้เป็นลิงก์ของใคร</summary><p>เป็นลิงก์ affiliate ของบัญชีคุณเอง ค่าคอมเข้าบัญชีคุณตามปกติ</p></details>
        <details><summary>Early Access คืออะไร</summary><p>รอบแรกเปิดให้ {me?.seats || 10} คนใช้ก่อน ใครสมัครหลังที่เต็มจะได้คิวไว้ และเปิดสิทธิ์ให้ตามลำดับ</p></details>
      </section>

      <section className="lp-final">
        <img src="/logo.svg" alt="" width="88" height="88" />
        <h2>ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</h2>
        <Cta me={me} onLogin={onLogin} big />
      </section>

      <footer className="lp-foot">ปั๊กปัก · เครื่องมือเลือกตะกร้าสำหรับคนทำคลิป Shopee Affiliate</footer>
    </div>
  );
}
