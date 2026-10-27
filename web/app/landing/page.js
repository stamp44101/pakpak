"use client";
// Preview of the public landing page (the same one signed-out visitors see at "/").
import { useEffect, useState } from "react";
import Landing from "../Landing";

export default function LandingPreview() {
  const [me, setMe] = useState(null);
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  return <Landing me={me} />;
}
