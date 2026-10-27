import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SCENES, CAPTIONS, PRODUCTS, ARRIVAL, RANKED, TOP_AI, f, vo, VO_OFFSET, TOTAL_SEC } from "./data";
import { BrowserWindow, AppHeader, ObStep, ProductRow, ROW_H, Thumb, LogoMark, Cursor, pathAt, Caption, Callout, clamp, lerp, useSpring } from "./ui";

const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const ACCENT = "#d9480f";

/* ---------------- background ---------------- */
function Bg({ tone = "light" }) {
  const frame = useCurrentFrame();
  const orange = tone === "orange";
  return (
    <AbsoluteFill style={{ background: orange ? ACCENT : "var(--bg)", overflow: "hidden" }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${orange ? "rgba(255,255,255,.18)" : "rgba(29,34,33,.09)"} 2px, transparent 2px)`, backgroundSize: "44px 44px", backgroundPosition: `0 ${frame * 0.6}px` }} />
      {[[180, 260, 520, 0], [880, 1500, 600, 2], [900, 300, 380, 4]].map(([x, y, r, k]) => (
        <div key={k} style={{ position: "absolute", left: x - r / 2 + Math.sin(frame / 40 + k) * 40, top: y - r / 2 + Math.cos(frame / 50 + k) * 40, width: r, height: r, borderRadius: "50%", background: orange ? "rgba(255,180,120,.45)" : "rgba(217,72,15,.13)", filter: "blur(70px)" }} />
      ))}
    </AbsoluteFill>
  );
}

/* ---------------- S1 hook: lots of clips, zero orders ---------------- */
function SceneHook() {
  const frame = useCurrentFrame();
  const shake = frame > f(1.9) && frame < f(2.4) ? Math.sin(frame * 3) * 10 : 0;
  const zeroFlash = frame >= f(2.0);
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", left: 60, top: 170, width: 960, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30, transform: `translateX(${shake}px)` }}>
        {Array.from({ length: 9 }).map((_, i) => {
          const s = spring({ frame: frame - i * 4, fps: 30, config: { damping: 12, stiffness: 140 } });
          const p = PRODUCTS[i];
          return (
            <div key={i} style={{ height: 420, borderRadius: 26, background: "#1d2221", position: "relative", overflow: "hidden", transform: `translateY(${(1 - s) * -700}px) rotate(${(1 - s) * (i % 2 ? 12 : -12)}deg)`, boxShadow: "0 16px 30px rgba(0,0,0,.2)" }}>
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, hsl(${p.hue} 40% 35%), #1d2221 70%)` }} />
              <svg style={{ position: "absolute", left: "50%", top: 120, transform: "translateX(-50%)" }} width="80" height="80" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="rgba(255,255,255,.18)" /><path d="M9.5 7.5 L17 12 L9.5 16.5 Z" fill="#fff" /></svg>
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 74, background: "#fff", borderRadius: 14, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <Thumb p={p} size={46} radius={8} />
                <div style={{ font: "600 20px/1.2 var(--body)", color: "#1d2221", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</div>
              </div>
              <div style={{ position: "absolute", left: 16, bottom: 18, font: "700 28px Kanit", color: zeroFlash && (frame >> 2) % 2 ? "#ff6b6b" : "#fff", display: "flex", gap: 8, alignItems: "center" }}>
                ออเดอร์ <span style={{ fontFamily: "IBM Plex Mono", fontSize: 34 }}>0</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/* ---------------- S2 problem: endless products, which basket? ---------------- */
function SceneProblem() {
  const frame = useCurrentFrame();
  const stop = f(vo(5.4) - SCENES.problem[0]);
  const scroll = frame < stop ? frame * 26 : stop * 26 + lerp(frame, stop, stop + 12, 0, 60);
  const pick = 7; // index of the card we zoom to
  const zoom = lerp(frame, stop, stop + 18, 1, 1.35);
  const cards = Array.from({ length: 36 });
  const cur = pathAt(frame, [[0, 300, 700], [20, 760, 520], [42, 260, 900], [62, 820, 980], [stop, 540, 760]]);
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "50% 45%" }}>
        <div style={{ position: "absolute", left: 50, top: 120 - (scroll % 1600), width: 980, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
          {cards.map((_, i) => {
            const p = PRODUCTS[i % PRODUCTS.length];
            const chosen = frame >= stop && i % 12 === pick && i < 24 && i >= 12;
            return (
              <div key={i} style={{ background: "#fff", borderRadius: 22, padding: 14, boxShadow: chosen ? `0 0 0 8px ${ACCENT}, 0 20px 40px rgba(217,72,15,.35)` : "0 6px 16px rgba(0,0,0,.08)", opacity: frame >= stop && !chosen ? 0.35 : 1 }}>
                <Thumb p={{ ...p, hue: p.hue + i * 7 }} size={276} radius={14} />
                <div style={{ font: "500 21px/1.3 var(--body)", marginTop: 10, height: 54, overflow: "hidden" }}>{p.name}</div>
                <div style={{ font: "600 26px var(--mono)", color: ACCENT, marginTop: 6 }}>฿{p.price}</div>
              </div>
            );
          })}
        </div>
      </div>
      {frame < stop && <Cursor x={cur.x} y={cur.y} />}
      {frame < stop && [[220, 420, 8], [700, 760, 24], [380, 1100, 40]].map(([x, y, d], k) => {
        const s = spring({ frame: frame - d, fps: 30, config: { damping: 9, stiffness: 200 } });
        return <div key={k} style={{ position: "absolute", left: x, top: y, transform: `scale(${s})`, width: 110, height: 110, borderRadius: 55, background: "#1d2221", color: "#fff", font: "700 72px/110px Kanit", textAlign: "center" }}>?</div>;
      })}
    </AbsoluteFill>
  );
}

/* ---------------- S3 + S8 brand reveal ---------------- */
function SceneLogo({ lines }) {
  const frame = useCurrentFrame();
  const s = useSpring(2, { damping: 9, stiffness: 140, mass: 0.9 });
  const flash = interpolate(frame, [0, 6], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg tone="orange" />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40, paddingBottom: 240 }}>
        <div style={{ transform: `scale(${s}) rotate(${(1 - s) * -25}deg)` }}><LogoMark size={300} color="#fff" accent={ACCENT} /></div>
        <div style={{ font: "700 190px/1 Anuphan", color: "#fff", transform: `translateY(${(1 - s) * 80}px)`, opacity: s, letterSpacing: "-0.02em" }}>ปั๊กปัก</div>
        {lines.map(([text, at, size], i) => {
          const ls = spring({ frame: frame - at, fps: 30, config: { damping: 12, stiffness: 170 } });
          return <div key={i} style={{ font: `600 ${size}px/1.25 Kanit`, color: "#fff", textAlign: "center", opacity: ls, transform: `translateY(${(1 - ls) * 40}px)`, padding: "0 60px" }}>{text}</div>;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/* ---------------- S4 connect: onboarding ticks off ---------------- */
function SceneConnect() {
  const frame = useCurrentFrame();
  const enter = useSpring(0, { damping: 16, stiffness: 120 });
  const tConnector = f(1.0), tClick = f(1.8), tShopee = f(2.4);
  const connector = frame >= tConnector, shopee = frame >= tShopee;
  const done = (connector ? 1 : 0) + (shopee ? 1 : 0);
  const prog = lerp(frame, tConnector, tConnector + 10, 0, 25) + lerp(frame, tShopee, tShopee + 10, 0, 25);
  const keyAt = f(vo(14.96) - SCENES.connect[0]);
  const conAt = f(vo(13.36) - SCENES.connect[0]);
  const cur = pathAt(frame, [[0, 900, 1000], [f(1.4), 290, 505], [tClick, 290, 505], [f(3.0), 760, 860]]);
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - enter) * 300}px)`, opacity: enter }}>
        <BrowserWindow tabs={["ปั๊กปัก", "Shopee Affiliate"]} height={1290} overlay={<>
          <Cursor x={cur.x} y={cur.y} clicks={[tClick]} />
          {frame >= conAt && frame < keyAt + 2 && <ConnectorPopup start={conAt} />}
        </>}>
          <div className="wrap" style={{ paddingBottom: 20 }}>
            <AppHeader connected={shopee} />
            <section className="panel onboard">
              <div className="bar" style={{ justifyContent: "space-between" }}>
                <h2>เริ่มต้นใช้งาน <span className="num hint">{done}/4</span></h2>
              </div>
              <div className="progress"><i style={{ width: `${prog}%`, transition: "none" }} /></div>
              <ol className="steps-list">
                <ObStep done={connector} current={!connector} title="ติดตั้ง ปั๊กปัก Connector" hint="ส่วนเสริม Chrome ที่อ่านข้อมูลจาก Shopee Affiliate ที่คุณล็อกอินไว้ ใช้เวลาราว 1 นาที">
                  <span className="btn primary">ดูวิธีติดตั้ง ↗</span><span className="btn">ติดตั้งแล้ว ตรวจอีกครั้ง</span>
                </ObStep>
                <ObStep done={shopee} current={connector && !shopee} title="เชื่อม Shopee Affiliate" hint="ระบบเปิดแท็บ Shopee Affiliate ให้ ล็อกอินตามปกติ แล้วกลับมาที่นี่ ระบบจะรู้เอง">
                  <span className="btn primary" style={frame >= tClick && frame < tClick + 6 ? { filter: "brightness(.85)" } : null}>เชื่อม Shopee Affiliate ↗</span>
                </ObStep>
                <ObStep done={false} current={shopee} title="สแกนตะกร้าแรก" hint="เลือกหมวดที่คุณทำคลิป ปั๊กปักจะดึงสินค้า 40 ตัวแล้วจัดอันดับให้">
                  <span className="btn primary">เลือกหมวด</span>
                </ObStep>
                <ObStep done={false} current={false} title="ลองให้ AI ให้คะแนน 1 ตัว" />
              </ol>
            </section>
          </div>
        </BrowserWindow>
      </div>
      {frame >= keyAt && <NoApiKey start={keyAt} />}
    </AbsoluteFill>
  );
}

function ConnectorPopup({ start }) {
  const s = useSpring(start, { damping: 13, stiffness: 200 });
  return (
    <div style={{ position: "absolute", right: 24, top: 18, width: 520, transform: `scale(${s})`, transformOrigin: "92% 0%", background: "#fff", borderRadius: 24, boxShadow: "0 20px 50px rgba(0,0,0,.22)", padding: 28, display: "flex", gap: 20, alignItems: "center", zIndex: 40 }}>
      <LogoMark size={84} color={ACCENT} accent="#fff" />
      <div>
        <div style={{ font: "700 34px Kanit" }}>ปั๊กปัก Connector</div>
        <div style={{ font: "500 26px var(--body)", color: "#2b8a3e", display: "flex", alignItems: "center", gap: 10 }}><i style={{ width: 14, height: 14, borderRadius: 7, background: "#2b8a3e" }} />เชื่อม Shopee Affiliate แล้ว</div>
      </div>
    </div>
  );
}

function NoApiKey({ start }) {
  const frame = useCurrentFrame();
  const s = useSpring(start, { damping: 12, stiffness: 180 });
  const strike = lerp(frame, start + 14, start + 24, 0, 1);
  const shake = frame > start + 24 && frame < start + 34 ? Math.sin(frame * 2.4) * 12 : 0;
  return (
    <AbsoluteFill style={{ background: `rgba(29,34,33,${0.45 * s})`, alignItems: "center", justifyContent: "center", paddingBottom: 260 }}>
      <div style={{ transform: `scale(${s}) translateX(${shake}px)`, background: "#fff", borderRadius: 30, padding: "44px 48px", width: 840, boxShadow: "0 30px 80px rgba(0,0,0,.35)", position: "relative" }}>
        <div style={{ font: "600 34px var(--body)", color: "#626b69", marginBottom: 18 }}>Shopee Open API</div>
        {["App ID", "API Key", "Secret"].map((l) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
            <span style={{ width: 160, font: "500 30px var(--body)" }}>{l}</span>
            <div style={{ flex: 1, height: 70, borderRadius: 14, border: "2px solid #dfe3e1", background: "#f5f6f4", font: "500 32px var(--mono)", color: "#9aa4a1", display: "flex", alignItems: "center", padding: "0 20px" }}>••••••••••••</div>
          </div>
        ))}
        <svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%" viewBox="0 0 840 400" preserveAspectRatio="none">
          <line x1="40" y1="40" x2={40 + 760 * strike} y2={40 + 320 * strike} stroke="#c92a2a" strokeWidth="18" strokeLinecap="round" />
          <line x1="800" y1="40" x2={800 - 760 * strike} y2={40 + 320 * strike} stroke="#c92a2a" strokeWidth="18" strokeLinecap="round" />
        </svg>
      </div>
      <Callout x={560} y={980} delay={start + 26} bg="#2b8a3e" rotate={-6} size={58}>ไม่ต้องใช้ ✓</Callout>
    </AbsoluteFill>
  );
}

/* ---------------- S5 scan: stream in, score, re-rank ---------------- */
const CHIPS = ["ของใช้ในบ้าน", "ห้องครัว", "ความงาม", "แก็ดเจ็ต", "สัตว์เลี้ยง"];
function ScanPanel({ chipOn, busy }) {
  return (
    <section className="panel" id="scan">
      <h2>ดึงสินค้าจาก Shopee Affiliate</h2>
      <div className="bar">{CHIPS.map((c) => <span key={c} className={"chip" + (chipOn === c ? " on" : "")}>{c}</span>)}</div>
      <div className="bar">
        <input className="grow" readOnly value="" placeholder="หรือพิมพ์คำค้น เช่น แปรงขัดห้องน้ำ" />
        <span className="btn">ดึงสินค้า</span>
      </div>
      {busy && <p className="hint" style={{ margin: 0, color: "var(--accent)" }}>{busy}</p>}
    </section>
  );
}

function SceneScan() {
  const frame = useCurrentFrame();
  const L = (t) => f(vo(t) - SCENES.scan[0]);
  const click = L(18.08) - 4;
  const A0 = click + 10; // first arrival
  const AI0 = L(20.96) + 4, AI1 = L(22.6);
  const S0 = L(22.96) + 4, S1 = S0 + 22;
  const scroll = lerp(frame, click + 8, click + 30, 0, 196);
  const arrived = ARRIVAL.filter((_, i) => frame >= A0 + i * 5).length;
  const busy = frame >= click && frame < A0 + 12 * 5 + 6 ? `กำลังดึงสินค้า ห้องครัว… ${Math.min(40, Math.round(arrived * 40 / 12))}/40` : null;
  const sortT = lerp(frame, S0, S1, 0, 1);
  const cur = pathAt(frame, [[0, 760, 900], [click - 6, 300, 152], [click + 10, 300, 152], [click + 30, 960, 760]]);
  const visible = 8;
  return (
    <AbsoluteFill>
      <Bg />
      <BrowserWindow tabs={["ปั๊กปัก", "Shopee Affiliate"]} height={1290} scrollY={scroll} overlay={<>
        <Cursor x={cur.x} y={cur.y - scroll * 1.7} clicks={[click]} />
        {frame >= L(18.96) && frame < S0 && <Callout x={170} y={1020} delay={L(18.96)} bg="#1d2221" rotate={0} size={40}>คะแนน 100 = data 60 + AI 40</Callout>}
        {frame >= S1 && <Callout x={660} y={36} delay={S1} rotate={6} size={60}>TOP 10</Callout>}
      </>}>
        <div className="wrap">
          <ScanPanel chipOn={frame >= click ? "ห้องครัว" : null} busy={busy} />
          <div className="bar"><span className="chip">ทุกหมวด <span className="num">{arrived}</span></span><span className={"chip" + (arrived ? " on" : "")}>ห้องครัว <span className="num">{arrived}</span></span></div>
          <div className="list" style={{ position: "relative", height: visible * ROW_H + 40 }}>
            {ARRIVAL.map((id, ai) => {
              const p = byId[id];
              const at = A0 + ai * 5;
              if (frame < at) return null;
              const ri = RANKED.indexOf(id);
              const inS = lerp(frame, at, at + 10, 0, 1);
              const top = ai * ROW_H + (ri - ai) * ROW_H * sortT;
              const aiFill = lerp(frame, AI0 + ri * 2, AI0 + ri * 2 + 18, 0, 1);
              const sorted = frame >= S0 + 11;
              return (
                <ProductRow key={id} p={p} rank={sorted ? ri + 1 : ai + 1} top10={frame >= S1 && ri < 10}
                  dataFill={lerp(frame, at + 2, at + 14, 0, 1)} aiFill={aiFill} aiShown={frame >= AI0 + ri * 2}
                  style={{ position: "absolute", left: 0, right: 0, top, height: ROW_H, opacity: inS, transform: `translateX(${(1 - inS) * 80}px)`, borderTop: ai === 0 && sortT === 0 ? 0 : undefined, zIndex: 20 - ri }} />
              );
            })}
          </div>
        </div>
      </BrowserWindow>
    </AbsoluteFill>
  );
}

/* ---------------- S6 + S7 detail, link, phone ---------------- */
function Detail({ frame, typeFrom, linkAt, copyAt, hookGlow }) {
  const hook = TOP_AI.hook;
  const n = Math.round(lerp(frame, typeFrom, typeFrom + 34, 0, hook.length, (x) => x));
  const p = byId.p1;
  return (
    <div className="detail">
      <Thumb p={p} size={220} radius={10} />
      <div className="hook" style={hookGlow ? { background: "var(--accent-soft)", boxShadow: `0 0 0 ${hookGlow * 3}px var(--accent)`, borderRadius: 6, padding: "4px 6px" } : null}>“{hook.slice(0, n)}{n < hook.length ? "|" : "”"}</div>
      <ol className="angles">{TOP_AI.angles.map((a, k) => <li key={k} style={{ opacity: lerp(frame, typeFrom + 30 + k * 8, typeFrom + 40 + k * 8, 0, 1) }}>{a}</li>)}</ol>
      <div className="why" style={{ opacity: lerp(frame, typeFrom + 56, typeFrom + 66, 0, 1) }}>{TOP_AI.why}</div>
      <div className="hint">AI ให้คะแนนแล้ว</div>
      {frame >= linkAt && <div className="linkbox" style={{ opacity: lerp(frame, linkAt, linkAt + 8, 0, 1) }}>https://s.shopee.co.th/8Kx2LpQ · Sub ID: pukpak</div>}
      <div className="bar">
        {frame >= linkAt ? <span className="btn primary" style={frame >= copyAt && frame < copyAt + 6 ? { filter: "brightness(.85)" } : null}>คัดลอกลิงก์</span> : <span className="btn primary">สร้างลิงก์ affiliate</span>}
        <span className="btn">หน้าสินค้า ↗</span>
      </div>
    </div>
  );
}

function RankedList({ upto = 7, detail, mobile = false }) {
  return (
    <div className="list">
      {RANKED.slice(0, upto).map((id, i) => (
        <ProductRow key={id} p={byId[id]} rank={i + 1} top10 mobile={mobile} highlight={i === 0 && !!detail}>{i === 0 ? detail : null}</ProductRow>
      ))}
    </div>
  );
}

function SceneDetail() {
  const frame = useCurrentFrame();
  const L = (t) => f(vo(t) - SCENES.detail[0]);
  const openAt = 8;
  const hookAt = L(29.36);
  const cam = lerp(frame, openAt, openAt + 24, 1, 1.12);
  const cur = pathAt(frame, [[0, 760, 700], [openAt, 520, 300], [openAt + 16, 980, 1100]]);
  const glow = lerp(frame, hookAt, hookAt + 8, 0, 1);
  return (
    <AbsoluteFill>
      <Bg />
      <BrowserWindow tabs={["ปั๊กปัก", "Shopee Affiliate"]} height={1290} scrollY={lerp(frame, openAt, openAt + 20, 0, 70)} overlay={<>
        <Cursor x={cur.x} y={cur.y} clicks={[openAt]} />
        {frame >= hookAt && <Callout x={560} y={560} delay={hookAt + 2} rotate={-5} size={50}>hook 3 วิแรก</Callout>}
      </>}>
        <div className="wrap">
          <RankedList upto={5} detail={frame >= openAt ? <Detail frame={frame} typeFrom={openAt + 8} linkAt={99999} copyAt={99999} hookGlow={glow} /> : null} />
        </div>
      </BrowserWindow>
    </AbsoluteFill>
  );
}

function SceneLink() {
  const frame = useCurrentFrame();
  const L = (t) => f(vo(t) - SCENES.link[0]);
  const linkAt = 12, copyAt = 32;
  const morph = L(33.44) - 4;
  const m = lerp(frame, morph, morph + 22, 0, 1);
  const phoneIn = useSpring(morph + 8, { damping: 14, stiffness: 110 });
  // window coordinates for the cursor (content area) — button sits low in the detail block
  const cur = pathAt(frame, [[0, 900, 1100], [linkAt - 2, 330, 905], [copyAt, 330, 905], [morph, 700, 1180]]);
  const toast = frame >= copyAt + 2 && frame < copyAt + 40;
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-m * 250}px, ${-m * 300}px) scale(${1 - m * 0.42})`, transformOrigin: "50% 50%" }}>
        <BrowserWindow tabs={["ปั๊กปัก", "Shopee Affiliate"]} height={1290} scrollY={70} overlay={<>
          {m < 0.2 && <Cursor x={cur.x} y={cur.y} clicks={[linkAt, copyAt]} />}
          {toast && <div className="toast" style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", font: "500 34px var(--body)", padding: "18px 32px", borderRadius: 16, background: "#1d2221", color: "#fff" }}>คัดลอกลิงก์แล้ว ✓</div>}
        </>}>
          <div className="wrap">
            <RankedList upto={5} detail={<Detail frame={frame + 200} typeFrom={0} linkAt={linkAt + 200 - 0} copyAt={copyAt + 200} hookGlow={0} />} />
          </div>
        </BrowserWindow>
      </div>
      {m > 0 && (
        <>
          <Phone style={{ position: "absolute", left: 560, top: 640, transform: `translateY(${(1 - phoneIn) * 1300}px) rotate(${(1 - phoneIn) * 10}deg)` }} />
          <SyncBadge delay={morph + 22} />
          <Callout x={110} y={200} delay={morph + 14} bg="#1d2221" rotate={-4} size={44}>สแกนบนคอม</Callout>
          <Callout x={600} y={540} delay={morph + 24} rotate={4} size={44}>ดูต่อบนมือถือ</Callout>
        </>
      )}
    </AbsoluteFill>
  );
}

function Phone({ style }) {
  return (
    <div style={{ width: 440, height: 900, borderRadius: 64, background: "#1d2221", padding: 14, boxShadow: "0 40px 80px rgba(0,0,0,.35)", ...style }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 52, overflow: "hidden", background: "var(--bg)", position: "relative" }}>
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 120, height: 34, borderRadius: 17, background: "#1d2221", zIndex: 5 }} />
        <div style={{ width: 360, transform: "scale(1.144)", transformOrigin: "0 0", paddingTop: 44 }}>
          <div className="wrap" style={{ padding: "12px 12px", gap: 10 }}>
            <header className="top"><div><h1 style={{ fontSize: 22 }}>ปั๊กปัก</h1><p className="sub" style={{ fontSize: 11 }}>ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</p></div></header>
            <div className="bar"><span className="chip">ทุกหมวด <span className="num">12</span></span><span className="chip on">ห้องครัว <span className="num">12</span></span></div>
            <RankedList upto={6} mobile />
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncBadge({ delay }) {
  const frame = useCurrentFrame();
  const s = useSpring(delay, { damping: 10, stiffness: 180 });
  return (
    <div style={{ position: "absolute", left: 420, top: 1060, transform: `scale(${s})`, width: 150, height: 150, borderRadius: 75, background: "#2b8a3e", display: "grid", placeItems: "center", boxShadow: "0 16px 30px rgba(43,138,62,.4)", zIndex: 30 }}>
      <svg width="86" height="86" viewBox="0 0 24 24" style={{ transform: `rotate(${frame * 6}deg)` }} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" /><path d="M18.5 3.5v3.8h-3.8M5.5 20.5v-3.8h3.8" /></svg>
    </div>
  );
}

/* ---------------- S9 CTA ---------------- */
function SceneCTA() {
  const frame = useCurrentFrame();
  const s = useSpring(0, { damping: 14, stiffness: 130 });
  const title = useSpring(4, { damping: 10, stiffness: 160 });
  const clickAt = f(3.3);
  const pulse = 1 + 0.04 * Math.sin(frame / 4) * (frame > f(2) ? 1 : 0);
  const cur = pathAt(frame, [[0, 980, 1500], [clickAt - 4, 225, 1030], [clickAt + 30, 225, 1030]]);
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `scale(${title})` }}>
          <LogoMark size={150} color={ACCENT} accent="#fff" />
          <div style={{ font: "700 140px/1 Anuphan", color: "#1d2221" }}>ปั๊กปัก</div>
        </div>
        <div style={{ font: "700 92px/1.2 Kanit", color: ACCENT, marginTop: 50, textAlign: "center", transform: `scale(${title})` }}>เปิด Early Access แล้ว!</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 30, top: 720, width: 1020, transform: `translateY(${(1 - s) * 400}px)`, opacity: s }}>
        <div style={{ width: 600, transform: "scale(1.7)", transformOrigin: "0 0" }}>
          <section className="panel hero-panel">
            <span className="eyebrow">Early Access</span>
            <h2 className="big">เลือกตะกร้าที่ทำคลิปแล้วขายได้ ก่อนเสียเวลาถ่าย</h2>
            <p className="hint">ปั๊กปักดึงสินค้าจาก Shopee Affiliate ของคุณ ให้คะแนนจากยอดขาย ค่าคอม รีวิว และให้ AI ประเมินว่าทำคลิปง่ายแค่ไหน พร้อม hook 3 วินาทีแรก</p>
            <div className="bar">
              <span className="btn line" style={{ transform: `scale(${frame >= clickAt && frame < clickAt + 5 ? 0.94 : pulse})` }}>เข้าสู่ระบบด้วย LINE</span>
              <span className="seats"><b className="num">10</b> ที่แรก ใช้ได้ทันที</span>
            </div>
          </section>
        </div>
      </div>
      <Cursor x={cur.x} y={cur.y} clicks={[clickAt]} />
      <Callout x={330} y={1520} delay={f(vo(42.64) - SCENES.cta[0])} rotate={-3} size={64}>สิบที่แรก ใช้ได้ทันที</Callout>
    </AbsoluteFill>
  );
}

/* ---------------- audio ---------------- */
const SFX = [
  ["glitch", vo(2.0)], ["whoosh", SCENES.problem[0] - 0.1], ["pop", vo(5.4)],
  ["impact", SCENES.logo[0]], ["whoosh", SCENES.connect[0] - 0.1], ["pop", SCENES.connect[0] + 1.0], ["click", SCENES.connect[0] + 1.8], ["pop", SCENES.connect[0] + 2.4], ["ding", vo(13.36)], ["glitch", vo(14.96) + 0.8], ["pop", vo(14.96) + 0.9],
  ["whoosh", SCENES.scan[0] - 0.1], ["click", vo(18.08) - 0.13], ["ding", vo(22.96) + 0.9],
  ["whoosh", SCENES.detail[0] - 0.1], ["click", SCENES.detail[0] + 0.27], ["pop", vo(29.36) + 0.07],
  ["click", SCENES.link[0] + 0.4], ["click", SCENES.link[0] + 1.07], ["pop", SCENES.link[0] + 1.1], ["whoosh", vo(33.44) - 0.1], ["ding", vo(33.44) + 0.6],
  ["impact", SCENES.brand[0]], ["whoosh", SCENES.cta[0] - 0.1], ["click", SCENES.cta[0] + 3.3], ["ding", vo(42.64)],
];
for (let t = 0; t < 12; t++) SFX.push(["tick", SCENES.scan[0] + (f(vo(18.08) - SCENES.scan[0]) + 6 + t * 5) / 30]);

function Sound() {
  const { durationInFrames } = useVideoConfig();
  const end = durationInFrames;
  return (
    <>
      <Audio src={staticFile("music.mp3")} volume={(fr) => interpolate(fr, [0, 10, f(vo(44.8)), f(vo(44.8)) + 15, end - 30, end], [0, 0.16, 0.16, 0.42, 0.42, 0], clamp)} />
      <Sequence from={f(VO_OFFSET)}><Audio src={staticFile("vo_raw.mp3")} volume={1} /></Sequence>
      {SFX.map(([n, t], i) => (
        <Sequence key={i} from={Math.max(0, f(t))} durationInFrames={f(1.2)}><Audio src={staticFile(n + ".wav")} volume={n === "tick" ? 0.35 : n === "whoosh" ? 0.5 : 0.6} /></Sequence>
      ))}
    </>
  );
}

/* ---------------- composition ---------------- */
const seq = (k) => ({ from: f(SCENES[k][0]), durationInFrames: f(SCENES[k][1]) - f(SCENES[k][0]) });

export function Promo() {
  return (
    <AbsoluteFill style={{ background: "var(--bg)", fontFamily: "var(--body)" }}>
      <Sequence {...seq("hook")}><SceneHook /></Sequence>
      <Sequence {...seq("problem")}><SceneProblem /></Sequence>
      <Sequence {...seq("logo")}><SceneLogo lines={[["ตัวช่วยเลือกตะกร้าให้ปัง", f(vo(8.88) - SCENES.logo[0]), 76]]} /></Sequence>
      <Sequence {...seq("connect")}><SceneConnect /></Sequence>
      <Sequence {...seq("scan")}><SceneScan /></Sequence>
      <Sequence {...seq("detail")}><SceneDetail /></Sequence>
      <Sequence {...seq("link")}><SceneLink /></Sequence>
      <Sequence {...seq("brand")}><SceneLogo lines={[["ปักตะกร้าให้ปัง", f(vo(37.56) - SCENES.brand[0]), 96], ["ต้องเริ่มจากเลือกตะกร้าให้เป็น", f(vo(38.96) - SCENES.brand[0]), 72]]} /></Sequence>
      <Sequence {...seq("cta")}><SceneCTA /></Sequence>
      {CAPTIONS.map(([s, e, t], i) => <Caption key={i} text={t} start={f(vo(s))} end={f(vo(e))} />)}
      <Sound />
    </AbsoluteFill>
  );
}
