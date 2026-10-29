// Member documents read in batches: 500+ parallel DB fetches ran the function out of sockets (EMFILE) on 29 Oct.
import { roster, getMember } from "./auth";

export async function membersOf(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 40) out.push(...(await Promise.all(ids.slice(i, i + 40).map(getMember))).filter(Boolean));
  return out;
}
// Every member: active, waitlist, revoked.
export async function allMembers(r) {
  r ||= await roster();
  return membersOf([...r.active, ...r.waitlist, ...(r.revoked || [])]);
}
