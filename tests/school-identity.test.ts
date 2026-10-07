import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { schoolAccessForVerifiedUser } from "../src/lib/school-identity";

const records: Record<string, Record<string, unknown>[]> = {
  teacher_profiles: [
    { id: "teacher", school_id: "school-a", active: true },
    { id: "disabled", school_id: "school-a", active: false },
    { id: "moved", school_id: "school-b", active: true },
  ],
  school_domains: [
    { domain: "2gimnazija.edu.ba", school_id: "school-a" },
    { domain: "other.edu.ba", school_id: "school-b" },
    { domain: "closed.edu.ba", school_id: "closed" },
  ],
  schools: [
    { id: "school-a", name: "Druga gimnazija", active: true },
    { id: "school-b", name: "Other school", active: true },
    { id: "closed", name: "Closed school", active: false },
  ],
};
const db = createClient("https://school-test.invalid", "test-key", { auth: { persistSession: false }, global: { fetch: async input => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const rows = (records[url.pathname.split("/").pop()!] || []).filter(row => [...url.searchParams].every(([field, value]) => !value.startsWith("eq.") || String(row[field]) === value.slice(3)));
  return Response.json(rows);
} } });
const check = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
const verified = { id: "student", email: "student@2gimnazija.edu.ba", email_confirmed_at: "2026-10-07T00:00:00Z" };

test("only verified, registered, active school domains receive student access", async () => {
  assert.deepEqual(await schoolAccessForVerifiedUser(verified, db, check), { schoolId: "school-a", schoolName: "Druga gimnazija", role: "student" });
  assert.equal(await schoolAccessForVerifiedUser({ ...verified, email_confirmed_at: undefined }, db, check), null);
  assert.equal(await schoolAccessForVerifiedUser({ ...verified, email: "student@2gimnazija.edu.ba.attacker.com" }, db, check), null);
  assert.equal(await schoolAccessForVerifiedUser({ ...verified, email: "student@closed.edu.ba" }, db, check), null);
  assert.equal(await schoolAccessForVerifiedUser({ ...verified, email: "student@other.edu.ba" }, db, check).then(x => x?.schoolId), "school-b");
});

test("only trusted active staff profiles grant teacher access, never user metadata", async () => {
  const forged = { ...verified, user_metadata: { role: "admin", school_id: "school-b" } };
  assert.equal((await schoolAccessForVerifiedUser(forged, db, check))?.role, "student");
  assert.equal((await schoolAccessForVerifiedUser({ ...verified, id: "teacher" }, db, check))?.role, "teacher");
  assert.equal(await schoolAccessForVerifiedUser({ ...verified, id: "disabled" }, db, check), null);
  assert.equal(await schoolAccessForVerifiedUser({ ...verified, id: "moved" }, db, check), null);
});
