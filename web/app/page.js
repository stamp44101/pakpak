import { cookies } from "next/headers";
import { readSessionValue, SESSION_COOKIE } from "../lib/auth";
import Home from "./Home";
import { faqJsonLd } from "../lib/faq";

// Signed-in visitors get the app shell straight away; everyone else (and crawlers) get the landing page.
export default function Page() {
  const signedIn = !!readSessionValue(cookies().get(SESSION_COOKIE)?.value);
  return (
    <>
      {!signedIn && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      <Home signedIn={signedIn} />
    </>
  );
}
