import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SCENES, CAPTIONS, PRODUCTS, TOP5, TOP_AI, f, vo, VO_OFFSET, baht } from "./data";
import { Thumb, LogoMark, Wordmark, BRAND_GRAD, Cursor, pathAt, Caption, Callout, clamp, lerp, useSpring } from "./ui";

const ACCENT = "#FE5408";
const LINE_GREEN = "#06C755";
const R = (k, t) => f(vo(t) - SCENES[k][0]); // VO time -> frame inside scene k

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
  const zeroFlash = frame >= f(vo(1.6));
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
              <div style={{ position: "absolute", left: 16, bottom: 18, font: "700 28px Kanit", color: i === 4 && zeroFlash ? "#69db7c" : zeroFlash && (frame >> 2) % 2 ? "#ff6b6b" : "#fff", display: "flex", gap: 8, alignItems: "center" }}>
                ออเดอร์ <span style={{ fontFamily: "IBM Plex Mono", fontSize: 34 }}>{i === 4 && zeroFlash ? 1 : 0}</span>
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
  const stop = f(vo(5.56) - SCENES.problem[0]);
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
  const w = useSpring(8, { damping: 12, stiffness: 150 });
  const flash = interpolate(frame, [0, 6], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ background: BRAND_GRAD, opacity: flash }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34, paddingBottom: 240 }}>
        <div style={{ transform: `scale(${s}) rotate(${(1 - s) * -25}deg)`, filter: "drop-shadow(0 30px 40px rgba(254,84,8,.35))" }}><LogoMark size={380} /></div>
        <div style={{ transform: `translateY(${(1 - w) * 80}px) scale(${0.8 + 0.2 * w})`, opacity: w }}><Wordmark width={760} /></div>
        {lines.map(([text, at, size, hl], i) => {
          const ls = spring({ frame: frame - at, fps: 30, config: { damping: 12, stiffness: 170 } });
          return <div key={i} style={{ font: `700 ${size}px/1.25 Kanit`, color: hl ? "#FE5408" : "#2d2926", textAlign: "center", opacity: ls, transform: `translateY(${(1 - ls) * 40}px)`, padding: "0 60px" }}>{text}</div>;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}


/* ================= phone + LINE chat kit ================= */
const PW = 600, PH = 1240, BEZ = 18;
const CSSW = 375, SC = (PW - BEZ * 2) / CSSW; // LINE UI authored at 375 css px
const CSSH = (PH - BEZ * 2) / SC;

function PhoneFrame({ x = 240, y = 220, children, style }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: PW, height: PH, borderRadius: 86, background: "#1d2221", padding: BEZ, boxShadow: "0 40px 90px rgba(0,0,0,.33)", ...style }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 70, overflow: "hidden", position: "relative", background: "#fff" }}>
        <div style={{ width: CSSW, height: CSSH, transform: `scale(${SC})`, transformOrigin: "0 0", position: "relative", overflow: "hidden" }}>{children}</div>
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", width: 150, height: 42, borderRadius: 21, background: "#1d2221", zIndex: 30 }} />
      </div>
    </div>
  );
}

// finger tap marker in video px
function Tap({ x, y, at, from = [x + 120, y + 260] }) {
  const frame = useCurrentFrame();
  if (frame < at - 16 || frame > at + 14) return null;
  const t = lerp(frame, at - 16, at, 0, 1);
  const px = from[0] + (x - from[0]) * t, py = from[1] + (y - from[1]) * t;
  const down = frame >= at && frame < at + 6;
  const ring = frame >= at ? interpolate(frame - at, [0, 14], [0, 1], clamp) : 0;
  return (
    <div style={{ position: "absolute", left: px - 40, top: py - 40, width: 80, height: 80, zIndex: 70, pointerEvents: "none", opacity: interpolate(frame, [at + 8, at + 14], [1, 0], clamp) }}>
      {ring > 0 && <div style={{ position: "absolute", inset: -40 * ring, borderRadius: "50%", border: `6px solid ${ACCENT}`, opacity: 1 - ring }} />}
      <div style={{ width: 80, height: 80, borderRadius: 40, background: "rgba(29,34,33,.32)", border: "5px solid #fff", boxShadow: "0 8px 18px rgba(0,0,0,.3)", transform: `scale(${down ? 0.8 : 1})` }} />
    </div>
  );
}
// convert phone css coords -> video px (for taps/callouts)
const P = (cx, cy, px = 240, py = 220) => [px + BEZ + cx * SC, py + BEZ + cy * SC];

function LineHeader() {
  return (
    <div style={{ height: 92, position: "relative", zIndex: 5, background: "#fff", display: "flex", alignItems: "center", gap: 9, padding: "50px 12px 0", borderBottom: "1px solid #eee" }}>
      <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15 4 L7 12 L15 20" stroke="#1d2221" strokeWidth="2.8" fill="none" strokeLinecap="round" /></svg>
      <Img src={staticFile("line-profile.png")} style={{ width: 30, height: 30, borderRadius: 15 }} />
      <b style={{ font: "700 17px Kanit" }}>ปั๊กปัก</b>
      <svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 2 L20 5 V11 C20 16 16 20 12 22 C8 20 4 16 4 11 V5 Z" fill={LINE_GREEN} /><path d="M8 12 L11 15 L16 9" stroke="#fff" strokeWidth="2.6" fill="none" /></svg>
    </div>
  );
}
const CHAT_BG = "#8ca5c7";
function Me({ children, show = 1 }) {
  return <div style={{ alignSelf: "flex-end", background: "#a7e88a", borderRadius: "16px 4px 16px 16px", padding: "8px 12px", font: "500 14px/1.4 var(--body)", maxWidth: 240, opacity: show, transform: `translateY(${(1 - show) * 16}px)` }}>{children}</div>;
}
function Bot({ children, show = 1, w = 270 }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", opacity: show, transform: `translateY(${(1 - show) * 16}px)` }}>
      <Img src={staticFile("line-profile.png")} style={{ width: 30, height: 30, borderRadius: 15, flex: "none" }} />
      <div style={{ background: "#fff", borderRadius: "4px 16px 16px 16px", padding: "8px 12px", font: "500 13px/1.45 var(--body)", maxWidth: w, whiteSpace: "pre-line" }}>{children}</div>
    </div>
  );
}
function Typing({ show = 1 }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", opacity: show }}>
      <Img src={staticFile("line-profile.png")} style={{ width: 30, height: 30, borderRadius: 15 }} />
      <div style={{ background: "#fff", borderRadius: 16, padding: "12px 14px", display: "flex", gap: 5 }}>
        {[0, 1, 2].map((i) => <i key={i} style={{ width: 7, height: 7, borderRadius: 4, background: "#999", opacity: 0.35 + 0.65 * Math.max(0, Math.sin((frame - i * 4) / 4)) }} />)}
      </div>
    </div>
  );
}
const RM_H = CSSW * 1686 / 2500;
function RichMenu({ open = 1, pressCell = -1 }) {
  const h = RM_H * open;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#161817" }}>
      <div style={{ height: h, overflow: "hidden", position: "relative" }}>
        <Img src={staticFile("richmenu.png")} style={{ width: CSSW, height: RM_H, display: "block" }} />
        {pressCell >= 0 && <div style={{ position: "absolute", left: (pressCell % 3) * CSSW / 3, top: Math.floor(pressCell / 3) * RM_H / 2, width: CSSW / 3, height: RM_H / 2, background: "rgba(255,255,255,.25)" }} />}
      </div>
      <div style={{ height: 30, background: "#fff", borderTop: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center", font: "600 13px var(--body)", color: "#444" }}>เมนู {open > 0.5 ? "▾" : "▴"}</div>
    </div>
  );
}
function QuickReplies({ show = 1 }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, padding: "8px 8px", display: "flex", gap: 6, overflow: "hidden", opacity: show, transform: `translateY(${(1 - show) * 20}px)` }}>
      {["ของใช้ในบ้าน", "ความงาม", "แก็ดเจ็ต", "สัตว์เลี้ยง", "อาหาร"].map((c) => <span key={c} style={{ flex: "none", background: "#fff", border: "1px solid #06C755", color: "#06C755", borderRadius: 16, padding: "5px 11px", font: "600 12px var(--body)" }}>{c}</span>)}
    </div>
  );
}

// LINE Flex "kilo" bubble — mirrors bubble() in web/app/api/line/webhook/route.js (Free variant)
const BW = 252;
function FlexCard({ p, n, glow = null, press = null }) {
  const row = (txt, size, color, weight = 400, key) => (
    <div style={{ font: `${weight} ${size}px/1.4 var(--body)`, color, boxShadow: glow === key ? `0 0 0 2px ${ACCENT}` : "none", background: glow === key ? "#FFF1E7" : "transparent", borderRadius: 4, margin: "0 -3px", padding: "0 3px" }}>{txt}</div>
  );
  const btn = (label, kind, key) => (
    <div style={{ height: 32, borderRadius: 6, display: "grid", placeItems: "center", font: `${kind === "link" ? 600 : 600} 13px var(--body)`, color: kind === "primary" ? "#fff" : kind === "link" ? "#42659a" : "#111", background: kind === "primary" ? "#FE6A0E" : kind === "secondary" ? "#dcdfe6" : "transparent", transform: press === key ? "scale(.94)" : "none", filter: press === key ? "brightness(.85)" : "none", boxShadow: glow === key ? `0 0 0 3px ${ACCENT}` : "none" }}>{label}</div>
  );
  return (
    <div style={{ width: BW, flex: "none", background: "#fff", borderRadius: 14, overflow: "hidden" }}>
      <Thumb p={p} size={BW} radius={0} />
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><b style={{ color: "#FE6A0E", font: "700 13px var(--body)" }}>#{n}</b><span style={{ font: "400 11px var(--body)", color: "#888" }}>คะแนน {p.total}/100</span></div>
        <div style={{ font: "700 13px/1.35 var(--body)", height: 36, overflow: "hidden" }}>{p.name}</div>
        {row(`${baht(p.price)} · คอม ${p.com}% · ได้ ~${baht(p.perOrder)}/ออเดอร์`, 11.5, "#555", 500, "money")}
        {row(`ขายแล้ว ${p.sold.toLocaleString("en-US")} · ★ ${p.rating.toFixed(1)}`, 11, "#888")}
        {row("เปิดในแอป → กดแชร์ ↗ → คัดลอกลิงก์ = ลิงก์ของคุณเอง", 10, "#E5480A")}
      </div>
      <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
        {btn("เปิดในแอป Shopee", "primary", "open")}
        {btn("คัดลอกลิงก์สินค้า", "secondary", "copy")}
        {btn("ให้ AI ดู", "link", "ai")}
      </div>
    </div>
  );
}
function Carousel({ x = 0, glow, press, show = 1 }) {
  return (
    <div style={{ display: "flex", gap: 8, paddingLeft: 42, transform: `translateX(${-x + (1 - show) * 300}px)`, opacity: show }}>
      {TOP5.map((p, i) => <FlexCard key={p.id} p={p} n={i + 1} glow={i === 0 ? glow : null} press={i === 0 ? press : null} />)}
    </div>
  );
}

/* ================= S4 sign up with LINE ================= */
function MiniLanding({ press }) {
  return (
    <div style={{ background: "#fffaf6", height: "100%", padding: "56px 20px 0" }}>
      <Img src={staticFile("wordmark.svg")} style={{ height: 30 }} />
      <div style={{ font: "700 40px/1.12 Kanit", marginTop: 40, color: "#2d2926" }}>รู้ก่อนถ่าย<br />ว่าตะกร้าไหน<br /><span style={{ color: ACCENT }}>ขายได้</span></div>
      <p style={{ font: "400 14px/1.6 var(--body)", color: "#626b69", margin: "16px 0 22px" }}>จัดอันดับสินค้า Shopee จากยอดขาย ค่าคอม และรีวิว แล้วให้ AI บอกว่าตัวไหนทำคลิปง่าย ใช้บนมือถือในแชท LINE ได้เลย</p>
      <div style={{ height: 54, borderRadius: 12, background: LINE_GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, font: "700 18px Kanit", transform: press ? "scale(.95)" : "none" }}>
        <LineMark size={26} />สมัครด้วย LINE
      </div>
      <p style={{ font: "500 13px var(--body)", color: "#626b69", textAlign: "center", marginTop: 12 }}>Early Access ใช้ Pro ฟรี 30 วัน</p>
    </div>
  );
}
const LINE_PATH = "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314";
function LineMark({ size = 24, color = "#fff" }) {
  return <svg viewBox="0 0 24 24" width={size} height={size}><path fill={color} d={LINE_PATH} /></svg>;
}
function AddFriend({ press }) {
  return (
    <div style={{ background: "#fff", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 120 }}>
      <Img src={staticFile("line-profile.png")} style={{ width: 110, height: 110, borderRadius: 55 }} />
      <div style={{ font: "700 24px Kanit", marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>ปั๊กปัก <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2 L20 5 V11 C20 16 16 20 12 22 C8 20 4 16 4 11 V5 Z" fill={LINE_GREEN} /><path d="M8 12 L11 15 L16 9" stroke="#fff" strokeWidth="2.6" fill="none" /></svg></div>
      <div style={{ font: "400 13px var(--body)", color: "#888", marginTop: 4 }}>ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</div>
      <div style={{ marginTop: 36, width: 260, height: 48, borderRadius: 10, background: LINE_GREEN, color: "#fff", display: "grid", placeItems: "center", font: "700 17px var(--body)", transform: press ? "scale(.95)" : "none" }}>เพิ่มเพื่อน</div>
    </div>
  );
}
function Welcome({ show }) {
  return (
    <Bot show={show} w={260}>
      <b style={{ font: "700 15px Kanit" }}>ยินดีต้อนรับสู่ปั๊กปัก</b>{"\n"}กด “ท็อป 5 วันนี้” ที่เมนูด้านล่าง เพื่อดูตะกร้าน่าทำคลิปของวันนี้
    </Bot>
  );
}

function SceneSignup() {
  const frame = useCurrentFrame();
  const enter = useSpring(0, { damping: 15, stiffness: 120 });
  const tap1 = R("signup", 13.84) - 2, tap2 = tap1 + 26;
  const chatAt = tap2 + 8;
  const slide = (at) => lerp(frame, at, at + 10, 1, 0);
  const lineBtn = P(187, 425), addBtn = P(187, 355);
  return (
    <AbsoluteFill>
      <Bg />
      <PhoneFrame style={{ transform: `translateY(${(1 - enter) * 1400}px) rotate(${(1 - enter) * -8}deg)` }}>
        <MiniLanding press={frame >= tap1 && frame < tap1 + 6} />
        {frame >= tap1 + 6 && <div style={{ position: "absolute", inset: 0, transform: `translateX(${slide(tap1 + 6) * 100}%)` }}><AddFriend press={frame >= tap2 && frame < tap2 + 6} /></div>}
        {frame >= chatAt && (
          <div style={{ position: "absolute", inset: 0, background: CHAT_BG, transform: `translateX(${slide(chatAt) * 100}%)` }}>
            <LineHeader />
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}><Welcome show={lerp(frame, chatAt + 8, chatAt + 16, 0, 1)} /></div>
            <RichMenu open={lerp(frame, chatAt + 14, chatAt + 26, 0, 1)} />
          </div>
        )}
      </PhoneFrame>
      <Tap x={lineBtn[0]} y={lineBtn[1]} at={tap1} />
      <Tap x={addBtn[0]} y={addBtn[1]} at={tap2} />
      <Callout x={70} y={140} delay={tap1} bg={LINE_GREEN} rotate={-5} size={50}>สมัครด้วย LINE</Callout>
      {frame >= R("signup", 16.32) && <Callout x={560} y={560} delay={R("signup", 16.32)} bg="#1d2221" rotate={5} size={46}>ไม่ต้องเปิดคอม</Callout>}
    </AbsoluteFill>
  );
}

/* ================= S5 top 5 in chat ================= */
function ChatTop5({ frame, tapAt, glow, press, swipe = 0, menuOpen }) {
  const t = (a, b = a + 8) => lerp(frame, a, b, 0, 1);
  return (
    <div style={{ position: "absolute", inset: 0, background: CHAT_BG }}>
      <LineHeader />
      <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 9 }}>
          <Me show={t(tapAt + 4)}>ท็อป</Me>
          {frame >= tapAt + 8 && frame < tapAt + 22 ? <Typing /> : <Bot show={t(tapAt + 22)} w={290}>ท็อป 5 หมวด “ห้องครัว” · ข้อมูล 2 ชม.ก่อน</Bot>}
        </div>
        <Carousel x={swipe} glow={glow} press={press} show={t(tapAt + 26, tapAt + 38)} />
      </div>
      <QuickReplies show={menuOpen < 0.5 ? t(tapAt + 34) : 0} />
      <RichMenu open={menuOpen} pressCell={frame >= tapAt && frame < tapAt + 6 ? 0 : -1} />
    </div>
  );
}

function SceneTop5() {
  const frame = useCurrentFrame();
  const tapAt = R("top5", 17.92) - 4;
  const menuOpen = lerp(frame, tapAt + 18, tapAt + 28, 1, 0);
  const sw1 = R("top5", 19.4), sw2 = R("top5", 20.4), back = R("top5", 21.0);
  const swipe = frame < back ? lerp(frame, sw1, sw1 + 14, 0, 260) + lerp(frame, sw2, sw2 + 14, 0, 260) : lerp(frame, back, back + 12, 520, 0);
  const glow = frame >= R("top5", 21.2) ? "money" : null;
  const cell = P(62, CSSH - 30 - RM_H + RM_H / 4);
  const zoom = lerp(frame, R("top5", 21.2), R("top5", 21.2) + 16, 1, 1.32);
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "40% 52%" }}>
        <PhoneFrame><ChatTop5 frame={frame} tapAt={tapAt} glow={glow} swipe={swipe} menuOpen={menuOpen} /></PhoneFrame>
      </div>
      <Tap x={cell[0]} y={cell[1]} at={tapAt} />
      {frame >= R("top5", 21.2) && <Callout x={560} y={1150} delay={R("top5", 21.2)} rotate={-4} size={46}>ค่าคอม 8%</Callout>}
      {frame >= R("top5", 22.16) && <Callout x={520} y={1270} delay={R("top5", 22.16)} bg="#2b8a3e" rotate={4} size={46}>ได้ ~฿72/ออเดอร์</Callout>}
    </AbsoluteFill>
  );
}

/* ================= S6 score 100 = data 60 + AI 40 ================= */
function SceneScore() {
  const frame = useCurrentFrame();
  const inS = useSpring(0, { damping: 14, stiffness: 140 });
  const p = TOP5[0];
  const dAt = R("score", 25.28), aAt = R("score", 27.88);
  const groups = [
    ["ข้อมูลจริงจาก Shopee", 60, p.d, "#626b69", [["ยอดขาย", 20, 19], ["ค่าคอม", 15, 12], ["รีวิว + เรตติ้ง", 10, 10], ["ราคาซื้อง่าย", 10, 7], ["ประเภทร้าน", 5, 4]], dAt],
    ["AI ประเมินคลิป", 40, p.a, ACCENT, [["โชว์ปัญหาได้ใน 3 วิ", 15, 14], ["ภาพหยุดนิ้ว", 15, 14], ["เล่าได้หลายคลิป", 10, 8]], aAt],
  ];
  const dNow = lerp(frame, dAt, dAt + 30, 0, p.d), aNow = lerp(frame, aAt, aAt + 30, 0, p.a);
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", left: 70, right: 70, top: 150, transform: `translateY(${(1 - inS) * 200}px)`, opacity: inS, background: "#fff", borderRadius: 40, padding: "44px 48px", boxShadow: "0 30px 70px rgba(0,0,0,.14)" }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Thumb p={p} size={130} radius={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 34px/1.3 var(--body)" }}>{p.name}</div>
            <div style={{ font: "500 26px var(--body)", color: "#626b69", marginTop: 6 }}>#1 หมวดห้องครัว</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "34px 0 10px" }}>
          <span style={{ font: "700 150px/1 'IBM Plex Mono'", color: ACCENT }}>{Math.round(dNow + aNow)}</span>
          <span style={{ font: "600 52px 'IBM Plex Mono'", color: "#9aa4a1" }}>/100</span>
        </div>
        <div style={{ height: 26, borderRadius: 13, background: "#e9ecea", overflow: "hidden", display: "flex" }}>
          <i style={{ width: `${dNow}%`, background: "#626b69" }} /><i style={{ width: `${aNow}%`, background: BRAND_GRAD }} />
        </div>
        {groups.map(([title, max, val, color, rows, at]) => (
          <div key={title} style={{ marginTop: 34, opacity: lerp(frame, at - 6, at + 4, 0.3, 1) }}>
            <div style={{ display: "flex", justifyContent: "space-between", font: "700 36px Kanit" }}><span style={{ color: color === ACCENT ? ACCENT : "#1d2221" }}>{title}</span><span style={{ fontFamily: "IBM Plex Mono" }}>{Math.round(lerp(frame, at, at + 30, 0, val))}/{max}</span></div>
            {rows.map(([label, w, v], i) => {
              const fill = lerp(frame, at + i * 5, at + i * 5 + 16, 0, v / w);
              return (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "300px 1fr 70px", alignItems: "center", gap: 16, marginTop: 12, font: "500 27px var(--body)", color: "#626b69" }}>
                  <span>{label}</span>
                  <div style={{ height: 14, borderRadius: 7, background: "#e9ecea", overflow: "hidden" }}><div style={{ height: "100%", width: `${fill * 100}%`, background: color === ACCENT ? BRAND_GRAD : color }} /></div>
                  <span style={{ fontFamily: "IBM Plex Mono", textAlign: "right" }}>{w}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/* ================= S7 ให้ AI ดู ================= */
function SceneAI() {
  const frame = useCurrentFrame();
  const tapAt = R("ai", 30.72) - 6;
  const typeAt = tapAt + 26;
  const scroll = lerp(frame, tapAt + 6, tapAt + 22, 0, 400);
  const msg = `${TOP5[0].name}\n\nAI: โชว์ปัญหา ${TOP_AI.scores.problem}/10 · ภาพหยุดนิ้ว ${TOP_AI.scores.visual}/10 · ต่อยอดหลายคลิป ${TOP_AI.scores.multi}/10`;
  const hook = TOP_AI.hook;
  const n = Math.round(lerp(frame, typeAt + 10, typeAt + 40, 0, hook.length, (x) => x));
  const ang = (i) => lerp(frame, R("ai", 33.6) + i * 6, R("ai", 33.6) + i * 6 + 8, 0, 1);
  const aiBtn = P(42 + BW / 2, 92 + 10 + 30 + 9 + 40 + 9 + 252 + 132 + 32 + 5 + 32 + 5 + 16);
  return (
    <AbsoluteFill>
      <Bg />
      <PhoneFrame>
        <div style={{ position: "absolute", inset: 0, background: CHAT_BG }}>
          <LineHeader />
          <div style={{ transform: `translateY(${-scroll}px)`, padding: "10px 0", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ padding: "0 10px" }}><Bot w={290}>ท็อป 5 หมวด “ห้องครัว” · ข้อมูล 2 ชม.ก่อน</Bot></div>
            <Carousel press={frame >= tapAt && frame < tapAt + 6 ? "ai" : null} glow={frame < tapAt + 6 ? "ai" : null} />
            <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 9 }}>
              <Me show={lerp(frame, tapAt + 6, tapAt + 14, 0, 1)}>ไอเดียคลิป #1</Me>
              {frame >= tapAt + 14 && frame < typeAt ? <Typing /> : frame >= typeAt && (
                <Bot w={292}>
                  {msg}{"\n\n"}<b style={{ color: ACCENT }}>Hook 3 วิแรก</b>{"\n"}<span style={{ font: "700 15px/1.45 var(--body)" }}>“{hook.slice(0, n)}{n < hook.length ? "|" : "”"}</span>
                  {"\n\n"}<b>มุมเล่า</b>
                  {TOP_AI.angles.map((a, i) => <span key={i} style={{ display: "block", opacity: ang(i) }}>• {a}</span>)}
                </Bot>
              )}
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 30, background: "#fff", borderTop: "1px solid #ddd", display: "grid", placeItems: "center", font: "600 13px var(--body)", color: "#444" }}>เมนู ▴</div>
        </div>
      </PhoneFrame>
      <Tap x={aiBtn[0]} y={aiBtn[1]} at={tapAt} />
      {frame >= R("ai", 31.76) && <Callout x={580} y={480} delay={R("ai", 31.76)} rotate={5} size={48}>hook 3 วิแรก</Callout>}
    </AbsoluteFill>
  );
}

/* ================= S8 get your own link in the Shopee app (real screen recording) ================= */
function Shot({ src, w, h, show = 1, zoom = 1, origin = "50% 50%", y = 0 }) {
  return (
    <div style={{ position: "absolute", left: 0, top: y, width: CSSW, height: CSSW * h / w, overflow: "hidden", opacity: show }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", display: "block", transform: `scale(${zoom})`, transformOrigin: origin }} />
    </div>
  );
}
function SceneLink() {
  const frame = useCurrentFrame();
  const s1 = 0, s3 = R("link", 36.0), s4 = R("link", 37.68);
  const fade = (a) => lerp(frame, a, a + 8, 0, 1);
  const tapOpen = R("link", 35.5);
  const tapShare = R("link", 36.88);
  const tapCopy = R("link", 37.75);
  const shareBtn = P(560 / 750 * CSSW, 160 + 70 / 750 * CSSW);
  const copyBtn = P(232 / 750 * CSSW, 140 + 700 / 750 * CSSW);
  return (
    <AbsoluteFill>
      <Bg />
      <PhoneFrame>
        <div style={{ position: "absolute", inset: 0, background: "#111" }}>
          {frame < s3 + 8 && <div style={{ position: "absolute", inset: 0, background: "#000", paddingTop: 140 }}><Shot src="step1.jpg" w={750} h={686} y={140} /></div>}
          {frame >= s3 && frame < s4 + 8 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: fade(s3) }}><Shot src="step3.jpg" w={750} h={477} y={160} /><div style={{ position: "absolute", top: 160 + CSSW * 477 / 750, left: 0, right: 0, bottom: 0, background: "linear-gradient(#f2f2f2,#fff)" }} /></div>}
          {frame >= s4 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", opacity: fade(s4) }}><div style={{ position: "absolute", left: 0, right: 0, top: 140, transform: `translateY(${(1 - fade(s4)) * 300}px)` }}><Shot src="step4.jpg" w={750} h={826} /></div></div>}
          <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", font: "700 14px Kanit", color: "#fff", background: "rgba(29,34,33,.85)", borderRadius: 12, padding: "4px 12px", whiteSpace: "nowrap", zIndex: 4 }}>หน้าจอจริงจากแอป Shopee</div>
        </div>
      </PhoneFrame>
      <Tap x={shareBtn[0]} y={shareBtn[1]} at={tapShare} />
      <Tap x={copyBtn[0]} y={copyBtn[1]} at={tapCopy} />
      <Callout x={60} y={150} delay={tapOpen} rotate={-5} size={46}>เปิดในแอป Shopee</Callout>
      {frame >= R("link", 38.56) && <Callout x={520} y={1180} delay={R("link", 38.56)} bg="#1d2221" rotate={4} size={46}>ลิงก์ของคุณเอง</Callout>}
      {frame >= R("link", 39.92) && <Callout x={480} y={1300} delay={R("link", 39.92)} bg="#2b8a3e" rotate={-3} size={46}>ค่าคอมเข้าบัญชีคุณ</Callout>}
    </AbsoluteFill>
  );
}

/* ================= S9 Free vs Pro ================= */
function ScenePro() {
  const frame = useCurrentFrame();
  const inS = useSpring(0, { damping: 14, stiffness: 140 });
  const proAt = R("pro", 42.96);
  const pro = spring({ frame: frame - proAt, fps: 30, config: { damping: 11, stiffness: 160 } });
  const ticks = [[R("pro", 44.0), "ดูได้ทุกตัว ไม่ใช่แค่ท็อป 5"], [R("pro", 45.12), "AI ไอเดียคลิป วันละ 30"], [R("pro", 47.04), "ลิงก์อัตโนมัติ Top 20 (ขั้นสูง บนคอม)"]];
  const card = (children, style) => <div style={{ background: "#fff", borderRadius: 36, padding: "40px 44px", boxShadow: "0 24px 60px rgba(0,0,0,.12)", ...style }}>{children}</div>;
  const li = (t, on, color) => <div key={t} style={{ display: "flex", gap: 16, alignItems: "flex-start", font: "500 32px/1.35 var(--body)", marginTop: 16, opacity: on }}><span style={{ color, fontWeight: 700 }}>✓</span><span>{t}</span></div>;
  return (
    <AbsoluteFill>
      <Bg />
      <div style={{ position: "absolute", left: 70, right: 70, top: 160, transform: `translateY(${(1 - inS) * 200}px)`, opacity: inS }}>
        {card(<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b style={{ font: "700 52px Kanit" }}>Free</b><b style={{ font: "700 60px 'IBM Plex Mono'" }}>฿0</b></div>
          {["ท็อป 5 ของทุกหมวด", "AI ไอเดียคลิป วันละ 3", "ใช้ในแชท LINE ได้ครบ"].map((t) => li(t, 1, "#2b8a3e"))}
        </>, { opacity: 1 - 0.45 * pro, transform: `scale(${1 - 0.06 * pro})` })}
        <div style={{ height: 34 }} />
        {card(<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ font: "700 60px Kanit", color: ACCENT }}>Pro</b>
            <span><b style={{ font: "700 72px 'IBM Plex Mono'" }}>฿199</b><span style={{ font: "500 30px var(--body)", color: "#626b69" }}>/เดือน</span></span>
          </div>
          <div style={{ font: "500 28px var(--body)", color: "#626b69", textAlign: "right" }}>หรือ ฿1,990/ปี ได้ฟรี 2 เดือน</div>
          {ticks.map(([at, t]) => li(t, lerp(frame, at, at + 8, 0.15, 1), ACCENT))}
        </>, { transform: `scale(${0.94 + 0.08 * pro})`, boxShadow: `0 0 0 ${6 * pro}px #FE6A0E, 0 30px 70px rgba(254,84,8,${0.3 * pro})` })}
      </div>
      {frame >= proAt && <Callout x={600} y={60} delay={proAt + 4} rotate={5} size={50}>อัปเป็น Pro</Callout>}
    </AbsoluteFill>
  );
}

/* ================= S11 CTA ================= */
function SceneCTA() {
  const frame = useCurrentFrame();
  const title = useSpring(2, { damping: 10, stiffness: 160 });
  const btn = useSpring(10, { damping: 12, stiffness: 150 });
  const tapAt = f(2.2);
  const pulse = 1 + 0.035 * Math.sin(frame / 4) * (frame > f(1.5) ? 1 : 0);
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
        <div style={{ transform: `scale(${title})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
          <LogoMark size={260} style={{ filter: "drop-shadow(0 26px 40px rgba(254,84,8,.35))" }} />
          <Wordmark width={560} />
        </div>
        <div style={{ font: "700 74px/1.2 Kanit", color: "#2d2926", marginTop: 50, textAlign: "center", transform: `scale(${title})` }}>รู้ก่อนถ่าย ว่าตะกร้าไหนขายได้</div>
        <div style={{ marginTop: 60, transform: `translateY(${(1 - btn) * 200}px) scale(${frame >= tapAt && frame < tapAt + 5 ? 0.94 : pulse})`, opacity: btn, height: 132, padding: "0 70px", borderRadius: 30, background: LINE_GREEN, color: "#fff", display: "flex", alignItems: "center", gap: 26, font: "700 60px Kanit", boxShadow: "0 20px 40px rgba(6,199,85,.35)" }}>
          <LineMark size={72} /><span style={{ width: 3, height: 70, background: "rgba(255,255,255,.4)" }} />สมัครด้วย LINE
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 44, opacity: btn }}>
          <span style={{ font: "600 38px var(--body)", padding: "14px 30px", borderRadius: 999, background: "#fff", border: "3px solid #dfe3e1" }}>เริ่มใช้ฟรี</span>
          <span style={{ font: "600 38px var(--body)", padding: "14px 30px", borderRadius: 999, background: "#FFF1E7", color: ACCENT, border: `3px solid ${ACCENT}` }}>Pro ฟรี 30 วัน</span>
        </div>
      </AbsoluteFill>
      <Tap x={540} y={1110} at={tapAt} />
    </AbsoluteFill>
  );
}

/* ================= audio ================= */
const SFX = [
  ["glitch", vo(1.6)], ["whoosh", SCENES.problem[0] - 0.1], ["pop", vo(5.56)],
  ["impact", SCENES.logo[0]], ["pop", vo(9.68)],
  ["whoosh", SCENES.signup[0] - 0.1], ["click", SCENES.signup[0] + (R("signup", 13.84) - 2) / 30], ["click", SCENES.signup[0] + (R("signup", 13.84) + 24) / 30], ["ding", SCENES.signup[0] + (R("signup", 13.84) + 40) / 30], ["pop", vo(16.32)],
  ["whoosh", SCENES.top5[0] - 0.1], ["click", vo(17.92) - 0.13], ["pop", vo(17.92) + 0.73], ["whoosh", vo(19.4)], ["whoosh", vo(20.4)], ["pop", vo(21.2)], ["ding", vo(22.16)],
  ["whoosh", SCENES.score[0] - 0.1], ["ding", vo(27.88) + 1.0],
  ["whoosh", SCENES.ai[0] - 0.1], ["click", vo(30.72) - 0.2], ["pop", vo(31.76)],
  ["whoosh", SCENES.link[0] - 0.1], ["click", vo(36.88)], ["click", vo(37.75)], ["ding", vo(38.56)], ["pop", vo(39.92)],
  ["whoosh", SCENES.pro[0] - 0.1], ["impact", vo(42.96)], ["tick", vo(44.0)], ["tick", vo(45.12)], ["tick", vo(47.04)],
  ["impact", SCENES.brand[0]], ["whoosh", SCENES.cta[0] - 0.1], ["click", SCENES.cta[0] + 2.2], ["ding", vo(55.92)],
];
for (let t = 0; t < 10; t++) SFX.push(["tick", vo(25.28) + t * 0.17]);

function Sound() {
  const { durationInFrames } = useVideoConfig();
  const end = durationInFrames;
  return (
    <>
      <Audio src={staticFile("music.mp3")} loop volume={(fr) => interpolate(fr, [0, 10, end - 40, end], [0, 0.15, 0.15, 0], clamp)} />
      <Sequence from={f(VO_OFFSET)}><Audio src={staticFile("vo2.mp3")} /></Sequence>
      {SFX.map(([n, t], i) => (
        <Sequence key={i} from={Math.max(0, f(t))} durationInFrames={f(1.2)}><Audio src={staticFile(n + ".wav")} volume={n === "tick" ? 0.35 : n === "whoosh" ? 0.45 : 0.55} /></Sequence>
      ))}
    </>
  );
}

/* ================= composition ================= */
const seq = (k) => ({ from: f(SCENES[k][0]), durationInFrames: f(SCENES[k][1]) - f(SCENES[k][0]) });

export function Promo() {
  return (
    <AbsoluteFill style={{ background: "var(--bg)", fontFamily: "var(--body)" }}>
      <Sequence {...seq("hook")}><SceneHook /></Sequence>
      <Sequence {...seq("problem")}><SceneProblem /></Sequence>
      <Sequence {...seq("logo")}><SceneLogo lines={[["รู้ก่อนถ่าย", R("logo", 9.68), 96, true], ["ว่าตะกร้าไหนขายได้", R("logo", 10.56), 80]]} /></Sequence>
      <Sequence {...seq("signup")}><SceneSignup /></Sequence>
      <Sequence {...seq("top5")}><SceneTop5 /></Sequence>
      <Sequence {...seq("score")}><SceneScore /></Sequence>
      <Sequence {...seq("ai")}><SceneAI /></Sequence>
      <Sequence {...seq("link")}><SceneLink /></Sequence>
      <Sequence {...seq("pro")}><ScenePro /></Sequence>
      <Sequence {...seq("brand")}><SceneLogo lines={[["ปักตะกร้าให้ปัง", R("brand", 49.32), 100, true], ["ต้องเริ่มจากเลือกตะกร้าให้เป็น", R("brand", 50.8), 72]]} /></Sequence>
      <Sequence {...seq("cta")}><SceneCTA /></Sequence>
      {CAPTIONS.map(([s, e, t], i) => <Caption key={i} text={t} start={f(vo(s))} end={f(vo(e))} />)}
      <Sound />
    </AbsoluteFill>
  );
}
