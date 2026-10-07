import "server-only";
import { cookies } from "next/headers";
import { adminSupabase, userSupabase } from "./supabase/server";
import { ApiError, dbError, hash } from "./server-utils";
export const SCHOOL_COOKIE = "schoolhub_school";
export const CHALLENGE_COOKIE = "schoolhub_school_challenge";
import { schoolAccessForVerifiedUser, type SchoolAccess } from "./school-identity";
export async function schoolAccess(): Promise<SchoolAccess | null> {
  const db = await userSupabase();
  const { data: { user } } = await db.auth.getUser();
  const admin = adminSupabase();
  if (user) return schoolAccessForVerifiedUser(user, admin, dbError);
  // Existing anonymous school cookies remain valid until their original seven-day expiry.
  const token = (await cookies()).get(SCHOOL_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await admin.from("school_sessions").select("school_id").eq("token_hash", hash(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  dbError(session.error);
  if (!session.data) return null;
  const school = await admin.from("schools").select("id,name").eq("id", session.data.school_id).eq("active", true).maybeSingle();
  dbError(school.error);
  return school.data ? { schoolId: school.data.id, schoolName: school.data.name, role: "student" } : null;
}
export async function requireSchool() {
  const access = await schoolAccess();
  if (!access) throw new ApiError("Verify your school email to access your school’s space.", 401);
  return access;
}
