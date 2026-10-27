import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing, Img, staticFile } from "remotion";
import { fmt } from "./data";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const lerp = (fr, a, b, from, to, e = ease) => interpolate(fr, [a, b], [from, to], { ...clamp, easing: e });
export const useSpring = (delay = 0, cfg = { damping: 14, stiffness: 160, mass: 0.8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: cfg });
};

/* ---------- product thumbnails (drawn, no external images) ---------- */
const ICONS = {
  fryer: <><rect x="18" y="16" width="28" height="34" rx="8" /><circle cx="32" cy="36" r="7" /><line x1="24" y1="23" x2="40" y2="23" /></>,
  knife: <><path d="M14 42 L44 16 L48 20 L22 46 Z" /><line x1="22" y1="46" x2="16" y2="52" /></>,
  dome: <><path d="M14 44 A18 18 0 0 1 50 44 Z" /><line x1="32" y1="26" x2="32" y2="20" /><line x1="10" y1="48" x2="54" y2="48" /></>,
  brush: <><line x1="20" y1="50" x2="40" y2="20" /><path d="M38 16 L50 22 L44 32 L34 26 Z" /></>,
  box: <><rect x="14" y="24" width="36" height="24" rx="5" /><rect x="12" y="18" width="40" height="7" rx="3" /></>,
  blender: <><path d="M22 14 H42 L38 40 H26 Z" /><rect x="22" y="40" width="20" height="10" rx="3" /></>,
  glove: <><path d="M20 50 V28 a6 6 0 0 1 12 0 V20 a5 5 0 0 1 10 0 V40 a10 10 0 0 1 -10 10 Z" /><line x1="20" y1="44" x2="42" y2="44" /></>,
  rack: <><line x1="14" y1="22" x2="50" y2="22" /><line x1="14" y1="36" x2="50" y2="36" /><line x1="14" y1="50" x2="50" y2="50" /><line x1="18" y1="16" x2="18" y2="50" /><line x1="46" y1="16" x2="46" y2="50" /></>,
  sponge: <><rect x="14" y="22" width="36" height="22" rx="6" /><circle cx="24" cy="31" r="2" /><circle cx="34" cy="35" r="2" /><circle cx="42" cy="29" r="2" /></>,
  pan: <><circle cx="28" cy="34" r="14" /><line x1="42" y1="34" x2="54" y2="34" /></>,
};
export function Thumb({ p, size = 64, radius = 8, style }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, flex: "none", background: `linear-gradient(135deg, hsl(${p.hue} 70% 62%), hsl(${p.hue + 25} 65% 44%))`, display: "grid", placeItems: "center", ...style }}>
      <svg viewBox="0 0 64 64" width={size * 0.78} height={size * 0.78} fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">{ICONS[p.icon]}</svg>
    </div>
  );
}

/* ---------- brand mark ---------- */
export function LogoMark({ size = 160, style }) {
  return <Img src={staticFile("logo.svg")} style={{ width: size, height: size, borderRadius: size * 0.226, display: "block", flex: "none", ...style }} />;
}
export function Wordmark({ width = 700, style }) {
  return <Img src={staticFile("wordmark.svg")} style={{ width, height: width * 1152 / 3168, display: "block", ...style }} />;
}
export const BRAND_GRAD = "linear-gradient(180deg,#FD8A18,#FE5408)";

/* ---------- cursor with click ripple ---------- */
export function Cursor({ x, y, clicks = [], scale = 1 }) {
  const frame = useCurrentFrame();
  const press = clicks.some((c) => frame >= c && frame < c + 5);
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 50, pointerEvents: "none" }}>
      {clicks.map((c) => {
        const t = frame - c;
        if (t < 0 || t > 18) return null;
        const r = interpolate(t, [0, 18], [10, 70]);
        return <div key={c} style={{ position: "absolute", left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: "50%", border: "5px solid #d9480f", opacity: interpolate(t, [0, 18], [0.9, 0]) }} />;
      })}
      <svg width={52 * scale} height={52 * scale} viewBox="0 0 24 24" style={{ transform: `scale(${press ? 0.85 : 1})`, transformOrigin: "0 0", filter: "drop-shadow(0 4px 6px rgba(0,0,0,.35))" }}>
        <path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.5 L12 14 L19 14 Z" fill="#1d2221" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// cursor path from keyframes [[frame, x, y], ...]
export function pathAt(frame, keys) {
  if (frame <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
  for (let i = 1; i < keys.length; i++) {
    const [f1, x1, y1] = keys[i];
    const [f0, x0, y0] = keys[i - 1];
    if (frame <= f1) {
      const t = interpolate(frame, [f0, f1], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1) });
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }
  }
  const l = keys[keys.length - 1];
  return { x: l[1], y: l[2] };
}

/* ---------- browser window holding the real app CSS ---------- */
export const APP_W = 600; // CSS px width of the app viewport
export function BrowserWindow({ x = 30, y = 170, width = 1020, height = 1300, tabs = ["ปั๊กปัก"], active = 0, address = "ปั๊กปัก", zoom = 1.7, scrollY = 0, origin = "50% 0%", camScale = 1, children, overlay, style }) {
  const bar = 92;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, height, borderRadius: 28, overflow: "hidden", background: "#fff", boxShadow: "0 30px 80px rgba(29,34,33,.22), 0 0 0 1px rgba(29,34,33,.08)", ...style }}>
      <div style={{ height: bar, background: "#eceeec", display: "flex", alignItems: "center", gap: 18, padding: "0 26px", borderBottom: "1px solid #dfe3e1" }}>
        <div style={{ display: "flex", gap: 10 }}>{["#ff5f57", "#febc2e", "#28c840"].map((c) => <i key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />)}</div>
        <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0 }}>
          {tabs.map((t, i) => (
            <div key={t} style={{ padding: "10px 22px", borderRadius: "14px 14px 0 0", background: i === active ? "#fff" : "transparent", font: "500 24px var(--body)", color: i === active ? "#1d2221" : "#626b69", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
              {i === 0 ? <LogoMark size={28} /> : <i style={{ width: 22, height: 22, borderRadius: 6, background: "#ee4d2d" }} />}{t}
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 58, display: "flex", alignItems: "center", padding: "0 22px", gap: 14, borderBottom: "1px solid #dfe3e1", background: "#fff" }}>
        <div style={{ flex: 1, height: 40, borderRadius: 20, background: "#f1f3f2", display: "flex", alignItems: "center", gap: 10, padding: "0 18px", font: "400 22px var(--body)", color: "#626b69" }}>
          <svg width="16" height="18" viewBox="0 0 16 18"><rect x="1" y="8" width="14" height="10" rx="2" fill="#626b69" /><path d="M4 8 V5 a4 4 0 0 1 8 0 V8" stroke="#626b69" strokeWidth="2" fill="none" /></svg>{address}
        </div>
        <LogoMark size={40} />
      </div>
      <div style={{ position: "relative", height: height - bar - 58, overflow: "hidden", background: "var(--bg)" }}>
        <div style={{ transform: `scale(${camScale})`, transformOrigin: origin, height: "100%" }}>
          <div style={{ width: APP_W, transform: `scale(${zoom}) translateY(${-scrollY}px)`, transformOrigin: "0 0" }}>{children}</div>
        </div>
        {overlay}
      </div>
    </div>
  );
}

/* ---------- pieces of the real ปั๊กปัก UI (same classNames as web/app) ---------- */
export function AppHeader({ connected = false, shopName = "myaffiliate" }) {
  return (
    <header className="top">
      <div className="brand">
        <LogoMark size={44} style={{ borderRadius: 11 }} />
        <div>
          <h1>ปั๊กปัก</h1>
          <p className="sub">ปักตะกร้าให้ปัง ต้องเริ่มจากเลือกตะกร้าให้เป็น</p>
        </div>
      </div>
      <div className="bar">
        <span className="avatar" style={{ background: "linear-gradient(135deg,#ffb38a,#d9480f)", display: "inline-block" }} />
        <span className="who">คุณ</span>
        <span className={"src" + (connected ? " ok" : "")}><i />{connected ? `Shopee: ${shopName}` : "ยังไม่เชื่อม Shopee"}</span>
      </div>
    </header>
  );
}

export function ObStep({ done, current, title, hint, children }) {
  return (
    <li className={"ob-step" + (done ? " done" : current ? " current" : "")}>
      <span className="ob-dot">{done ? "✓" : ""}</span>
      <div style={{ minWidth: 0 }}>
        <b>{title}</b>
        {!done && current && <><p className="hint" style={{ margin: "2px 0 8px" }}>{hint}</p><div className="bar">{children}</div></>}
      </div>
    </li>
  );
}

export const ROW_H = 120;
export function ProductRow({ p, rank, top10 = false, dataFill = 1, aiFill = 1, aiShown = true, total, style, children, highlight, mobile = false }) {
  const dScore = p.d * dataFill;
  const aScore = p.a * aiFill;
  const t = total != null ? total : dScore + (aiShown ? aScore : 0);
  const m = mobile ? { row: { gridTemplateColumns: "24px 52px minmax(0,1fr) 44px" }, scores: { gridColumn: "3 / -1", gridRow: 2 }, total: { gridColumn: 4, gridRow: 1 } } : {};
  return (
    <div className={"row" + (top10 ? " top10" : "")} style={{ contentVisibility: "visible", ...m.row, ...style }}>
      <div className="rank">{rank}</div>
      <Thumb p={p} size={mobile ? 52 : 64} />
      <div style={{ minWidth: 0 }}>
        <div className="name">{p.name}</div>
        <div className="meta">
          <span>฿<span className="num">{fmt(p.price)}</span></span>
          <span>ขาย <span className="num">{fmt(p.sold)}</span></span>
          <span>คอม <span className="num">{p.com}%</span> ≈ ฿<span className="num">{fmt(p.perOrder)}</span>/ชิ้น</span>
          <span>★ <span className="num">{p.rating}</span></span>
          {p.shop && <span className="tag">{p.shop}</span>}
        </div>
      </div>
      <div className="scores" style={m.scores}>
        <div className="sline"><span>data</span><div className="track"><div className="fill" style={{ width: `${(dScore / 60) * 100}%` }} /></div><span className="num">{Math.round(dScore)}</span></div>
        <div className="sline"><span>AI</span><div className="track"><div className="fill ai" style={{ width: `${aiShown ? (aScore / 40) * 100 : 0}%` }} /></div><span className="num">{aiShown ? Math.round(aScore) : "–"}</span></div>
      </div>
      <div className="total" style={{ ...m.total, ...(highlight ? { color: "var(--accent)" } : null) }}>{Math.round(t)}</div>
      {children}
    </div>
  );
}

/* ---------- bouncy caption ---------- */
export function Caption({ text, start, end, y = 1580 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start || frame > end + 4) return null;
  const s = spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  const out = interpolate(frame, [end - 1, end + 4], [1, 0], clamp);
  const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: y, display: "flex", justifyContent: "center", zIndex: 80, opacity: out }}>
      <div style={{ transform: `translateY(${(1 - s) * 40}px) scale(${0.85 + 0.15 * s})`, background: "#1d2221", color: "#fff", borderRadius: 28, padding: "22px 40px 26px", font: "700 66px/1.25 Kanit", textAlign: "center", boxShadow: "0 18px 40px rgba(0,0,0,.25)", maxWidth: 1000 }}>
        {parts.map((pt, i) => pt.startsWith("*") ? <span key={i} style={{ color: "#ff8a4c" }}>{pt.slice(1, -1)}</span> : <span key={i}>{pt}</span>)}
      </div>
    </div>
  );
}

/* ---------- floating label used to call things out ---------- */
export function Callout({ children, x, y, delay = 0, bg = BRAND_GRAD, rotate = -4, size = 44 }) {
  const s = useSpring(delay, { damping: 10, stiffness: 200, mass: 0.6 });
  if (s <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${s}) rotate(${rotate}deg)`, transformOrigin: "50% 50%", background: bg, color: "#fff", font: `700 ${size}px/1.2 Kanit`, padding: "14px 28px", borderRadius: 20, boxShadow: "0 14px 30px rgba(254,84,8,.35)", zIndex: 60, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}
