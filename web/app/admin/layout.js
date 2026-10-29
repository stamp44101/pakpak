// Gate the whole /admin tree (members, campaigns, …) on the server: non-admins never get the page shell,
// buttons or forms. The APIs under /api/admin keep their own guard — this only stops the UI from showing.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionValue, isAdmin } from "../../lib/auth";

export const metadata = { title: "จัดการสมาชิก", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function L({ children }) {
  const s = readSessionValue(cookies().get(SESSION_COOKIE)?.value);
  if (!s) redirect("/");
  if (!(await isAdmin(s.sub))) redirect("/");
  return children;
}
