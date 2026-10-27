import { cookies } from "next/headers";
import { readSessionValue, SESSION_COOKIE } from "../lib/auth";
import Home from "./Home";

// Signed-in visitors get the app shell straight away; everyone else (and crawlers) get the landing page.
export default function Page() {
  const signedIn = !!readSessionValue(cookies().get(SESSION_COOKIE)?.value);
  return <Home signedIn={signedIn} />;
}
