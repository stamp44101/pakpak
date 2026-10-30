// Bulk member reads for /admin, announcements and campaigns: one query for every document
// (was one query per member: 500+ round trips, ran out of sockets on 29 Oct).
// Read-only view: a lapsed order is shown as lapsed but not written back; getMember() still does that per member.
import { roster, memberPath } from "./auth";
import { readMany } from "./store";
import { expireOrder } from "./plan";

// Fields the bulk views use (/admin list, announcements, Free welcome, campaigns). Anything else stays in the DB.
// Add a key here when one of those views starts reading a new member field.
// These are partial documents: never saveMember() one, re-read with getMember() before writing.
export const LIST_KEYS = ["id", "name", "picture", "status", "joinedAt", "ai", "onboarding", "plan", "proUntil", "earlyAccess",
  "pendingOrder", "orderExpired", "freeSince", "welcomeFree", "welcomePushedAt", "trialAt", "followReward", "grants",
  "founding", "foundingOffer", "promo", "payments", "news", "webPromo"];

export async function membersOf(ids) {
  const docs = await readMany(ids.map(memberPath), LIST_KEYS);
  for (const m of docs) expireOrder(m);
  return docs;
}
// Every member: active, waitlist, revoked.
export async function allMembers(r) {
  r ||= await roster();
  return membersOf([...r.active, ...r.waitlist, ...(r.revoked || [])]);
}
