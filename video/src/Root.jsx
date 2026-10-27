import React, { useEffect, useState } from "react";
import { Composition, continueRender, delayRender } from "remotion";
import "./style.css";
import { Promo } from "./Promo";
import { FPS, W, H, TOTAL_SEC } from "./data";

const FONTS = ["500 20px Anuphan", "700 20px Anuphan", "400 20px 'IBM Plex Sans Thai'", "500 20px 'IBM Plex Sans Thai'", "600 20px 'IBM Plex Sans Thai'", "400 20px 'IBM Plex Mono'", "500 20px 'IBM Plex Mono'", "600 20px Kanit", "700 20px Kanit"];

function Loaded() {
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all(FONTS.map((f) => document.fonts.load(f, "ปั๊กปัก abc 123"))).then(() => document.fonts.ready).then(() => continueRender(h));
  }, [h]);
  return <Promo />;
}

export const Root = () => (
  <Composition id="Promo" component={Loaded} durationInFrames={TOTAL_SEC * FPS} fps={FPS} width={W} height={H} />
);
