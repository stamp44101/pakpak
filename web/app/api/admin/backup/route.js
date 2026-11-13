// Daily backup of the whole kv table → gzipped JSON asset on a GitHub release (private repo).
// Run by Vercel Cron (web/vercel.json, 03:00 Thai time) with "Authorization: Bearer $CRON_SECRET";
// an admin signed in to the web app can also open /api/admin/backup to run it by hand.
// Env: CRON_SECRET, GITHUB_BACKUP_TOKEN (fine-grained, Contents: read & write on the backup repo only),
//      GITHUB_BACKUP_REPO (default stamp44101/pakpak-backup — must be private and have at least one commit).
import { gzipSync } from "zlib";
import { dumpAll } from "../../../../lib/store";
import { requireMember, isAdmin } from "../../../../lib/auth";
import { notifyDiscord, notifyError } from "../../../../lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEEP_DAYS = 14;
const TAG = "daily";

async function allowed(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const { member, error } = await requireMember(req);
  return !error && (await isAdmin(member.id));
}

export async function GET(req) {
  if (!(await allowed(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  try {
    const out = await backup();
    notifyDiscord("backup", { title: `💾 backup ok · ${out.rows} แถว · ${out.mb} MB (gz)`, lines: [`${out.name}${out.pruned ? ` · ลบของเก่า ${out.pruned} ไฟล์` : ""}${out.pruneFailed ? ` · ลบของเก่าไม่สำเร็จ ${out.pruneFailed} ไฟล์ (ลองใหม่คืนพรุ่งนี้)` : ""}`] }).catch(() => {});
    return Response.json({ ok: true, ...out });
  } catch (err) {
    console.error("backup", err);
    await notifyError("🔥 backup ล้มเหลว", [String(err?.message || err)]);
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

async function backup() {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO || "stamp44101/pakpak-backup";
  if (!token) throw new Error("GITHUB_BACKUP_TOKEN ยังไม่ได้ตั้งใน Vercel env");

  const rows = await dumpAll();
  const body = gzipSync(Buffer.from(JSON.stringify({ at: new Date().toISOString(), rows })));
  const day = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10); // Thai date
  const name = `kv-${day}.json.gz`;

  // GitHub answers 5xx now and then (13 Nov 2026: a 500 on a delete cost that night's backup) — try up to 3 times.
  const gh = async (url, opt = {}) => {
    let r;
    for (let i = 0; i < 3; i++) {
      if (i) await new Promise((ok) => setTimeout(ok, 1500 * i));
      try {
        r = await fetch(url.startsWith("http") ? url : `https://api.github.com/repos/${repo}${url}`, {
          ...opt, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...opt.headers },
        });
      } catch (err) { if (i === 2) throw err; continue; }
      r.tries = i + 1;
      if (r.status < 500) break;
    }
    return r;
  };
  const must = async (r, what) => { if (!r.ok) throw new Error(`GitHub ${what} ${r.status}: ${(await r.text()).slice(0, 200)}`); return r; };

  let rel = await gh(`/releases/tags/${TAG}`);
  if (rel.status === 404) {
    rel = await must(await gh("/releases", { method: "POST", body: JSON.stringify({ tag_name: TAG, name: "Daily kv backups", body: `Rolling ${KEEP_DAYS}-day backups of the pakpak kv table.` }) }), "create release");
  } else await must(rel, "get release");
  const release = await rel.json();

  const assets = release.assets || [];
  const del = (a) => gh(`/releases/assets/${a.id}`, { method: "DELETE" });

  // Same-day rerun replaces the file (GitHub refuses a second asset with the same name). Already gone = fine.
  for (const a of assets.filter((a) => a.name === name)) {
    const r = await del(a);
    if (r.status !== 404) await must(r, "delete asset");
  }

  // If a retried upload says the name exists, an earlier try got through after all.
  const up = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  const sent = await gh(up, { method: "POST", headers: { "content-type": "application/gzip", "content-length": String(body.length) }, body });
  if (!(sent.status === 422 && sent.tries > 1)) await must(sent, "upload");

  // Only after today's file is safe: drop anything older than KEEP_DAYS. A failed delete never fails the backup —
  // the file is simply picked up again the next night.
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  let pruned = 0, pruneFailed = 0;
  for (const a of assets.filter((a) => a.name !== name && new Date(a.created_at).getTime() < cutoff)) {
    const r = await del(a).catch(() => null);
    if (r && (r.ok || r.status === 404)) pruned++; else pruneFailed++;
  }

  return { name, rows: rows.length, mb: +(body.length / 1048576).toFixed(2), pruned, pruneFailed };
}
