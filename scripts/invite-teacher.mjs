import { createClient } from "@supabase/supabase-js";
const [email, displayName, role = "teacher"] = process.argv.slice(2);
if (!email || !displayName || !["admin", "teacher"].includes(role)) {
  console.error('Usage: npm run teacher:invite -- "email@school.edu" "Ms. Teacher" [teacher|admin]'); process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const preflight = await db.from("teacher_profiles").select("id").limit(1);
if (preflight.error) { console.error("Apply the SchoolHub database migration first."); process.exit(1); }
const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/teacher` });
if (error || !data.user) { console.error("Unable to invite teacher. Check the email address and Supabase email delivery configuration."); process.exit(1); }
const profile = await db.from("teacher_profiles").insert({ id: data.user.id, display_name: displayName, role, handles_general: role === "admin" });
if (profile.error) { await db.auth.admin.deleteUser(data.user.id); console.error("Could not save the teacher profile. No account was kept."); process.exit(1); }
console.log(`Invitation sent. ${role === "admin" ? "Administrator" : "Teacher"} profile is ready.`);
