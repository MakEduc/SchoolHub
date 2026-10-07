import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const result = await db.from("departments").select("id", { count: "exact" }).limit(1);
if (result.error) {
  console.error(result.error.code === "PGRST205" ? "Connected to Supabase. SchoolHub tables are missing. Run supabase/migrations/202610060001_schoolhub.sql in the Supabase SQL Editor." : `Database check failed (${result.error.code}).`);
  process.exitCode = 1;
} else {
  console.log(`SchoolHub is connected. ${result.count ?? 0} departments configured.`);
  const check = await db.rpc("consume_rate_limit", { p_key: "installation-check", p_max: 1, p_seconds: 1 });
  if (check.error) { console.error("Rate-limit RPC is missing or inaccessible."); process.exitCode = 1; }
  else console.log("Server-only RPCs are available.");
  const replies = await db.from("questions").select("id,visibility,answer,receipt_token_hash").limit(0);
  if (replies.error) { console.error("Question replies/visibility are not installed. Apply supabase/migrations/202610070001_question_replies.sql."); process.exitCode = 1; }
  else console.log("Question replies and visibility are available.");
  const schoolChecks = await Promise.all([
    db.from("teacher_profiles").select("id,school_id").limit(0),
    db.from("schools").select("id").limit(0),
    db.from("school_domains").select("domain").limit(0),
    db.from("school_sessions").select("token_hash").limit(0),
    db.from("school_challenges").select("id").limit(0),
  ]);
  if (schoolChecks.some(result => result.error)) {
    console.error("School verification/isolation is not installed. Apply 202610070001_question_replies.sql, then supabase/migrations/202610070002_school_isolation.sql before deploying the new app.");
    process.exitCode = 1;
  } else console.log("School verification and isolation tables are available.");
}
