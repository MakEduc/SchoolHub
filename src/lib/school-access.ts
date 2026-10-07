import "server-only";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import { adminSupabase, userSupabase } from "./supabase/server";
import { ApiError, dbError, hash } from "./server-utils";
export const SCHOOL_COOKIE = "schoolhub_school";
export const CHALLENGE_COOKIE = "schoolhub_school_challenge";
export const schoolCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
export type SchoolAccess = { schoolId: string; schoolName: string; role: "student" | "teacher" };
export async function schoolAccess(): Promise<SchoolAccess | null> {
  const db = await userSupabase();
  const { data: { user } } = await db.auth.getUser();
  const admin = adminSupabase();
  if (user?.email_confirmed_at) {
    const profile = await admin.from("teacher_profiles").select("school_id").eq("id", user.id).eq("active", true).maybeSingle();
    dbError(profile.error);
    if (profile.data) {
      const domain = await admin.from("school_domains").select("school_id").eq("domain", user.email!.split("@")[1].toLowerCase()).eq("school_id", profile.data.school_id).maybeSingle();
      dbError(domain.error);
      if (!domain.data) return null;
      const school = await admin.from("schools").select("id,name").eq("id", profile.data.school_id).eq("active", true).maybeSingle();
      dbError(school.error);
      if (school.data) return { schoolId: school.data.id, schoolName: school.data.name, role: "teacher" };
    }
  }
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
export async function sendSchoolCode(email: string, code: string, language: "en" | "bs") {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) throw new ApiError("School email verification is not configured yet. Contact your school administrator.", 503);
  const port = Number(process.env.SMTP_PORT || "587");
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD }, logger: false, debug: false, connectionTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  try {
    await transport.sendMail({ from: SMTP_FROM, to: email,
      subject: language === "bs" ? "SchoolHub: potvrdite školu" : "SchoolHub: verify your school",
      text: language === "bs" ? `Vaš SchoolHub kod je ${code}. Vrijedi 10 minuta. Ne dijelite ga. Ako niste zatražili kod, zanemarite poruku.` : `Your SchoolHub code is ${code}. It expires in 10 minutes. Do not share it. If you did not request this code, ignore this email.`,
    });
  } catch { throw new ApiError("We could not send a verification code. Please try again later.", 503); }
  finally { transport.close(); }
}
