import type { SupabaseClient, User } from "@supabase/supabase-js";
import { schoolEmailDomain } from "./school-verification";

export type SchoolAccess = { schoolId: string; schoolName: string; role: "student" | "teacher" };

// Caller must obtain this user from Auth.getUser(), never from a request body or user metadata.
export async function schoolAccessForVerifiedUser(user: Pick<User, "id" | "email" | "email_confirmed_at">, db: SupabaseClient, check: (error: { code?: string; message: string } | null) => void): Promise<SchoolAccess | null> {
  const domain = user.email && user.email_confirmed_at ? schoolEmailDomain(user.email) : null;
  if (!domain) return null;
  const [profile, membership] = await Promise.all([
    db.from("teacher_profiles").select("school_id,active").eq("id", user.id).maybeSingle(),
    db.from("school_domains").select("school_id").eq("domain", domain).maybeSingle(),
  ]);
  check(profile.error); check(membership.error);
  if (!membership.data || (profile.data && (!profile.data.active || profile.data.school_id !== membership.data.school_id))) return null;
  const school = await db.from("schools").select("id,name").eq("id", membership.data.school_id).eq("active", true).maybeSingle();
  check(school.error);
  return school.data ? { schoolId: school.data.id, schoolName: school.data.name, role: profile.data ? "teacher" : "student" } : null;
}
