import { z } from "zod";

export const SCHOOL_TIMEZONE = process.env.NEXT_PUBLIC_SCHOOL_TIMEZONE || "Europe/Warsaw";
export const PROGRAMMES = ["IB", "National"] as const;
export type Programme = typeof PROGRAMMES[number];
export const GRADES = ["Grade I", "Grade II", "Grade III", "Grade IV"] as const;
export const questionSchema = z.object({
  body: z.string().trim().min(3, "Write at least 3 characters.").max(280, "Keep your question within 280 characters."),
  visibility: z.enum(["private", "public"]).default("private"),
  recipientType: z.enum(["teacher", "department", "general"]),
  recipientId: z.uuid().nullable(),
  website: z.string().max(0, "Submission rejected.").optional(),
}).refine(v => v.recipientType === "general" ? v.recipientId === null : v.recipientId !== null,
  { message: "Choose a teacher or department." });
export const studySchema = z.object({
  programme: z.enum(PROGRAMMES), grade: z.enum(GRADES), subjectId: z.uuid(),
  focus: z.string().trim().min(3).max(80), meetingPlace: z.string().trim().min(1, "Type your meeting place.").max(80),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
  openSpots: z.number().int().min(1).max(99).nullable(),
  hostName: z.string().trim().max(60).nullable(), contact: z.string().trim().max(80).nullable(),
  website: z.string().max(0).optional(),
})
  .refine(v => new Date(v.endsAt) > new Date(v.startsAt), { message: "End time must be after start time." })
  .refine(v => new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() <= 12 * 3600_000,
    { message: "A session can last up to 12 hours." });
export const debateSchema = z.object({
  prompt: z.string().trim().min(5).max(300),
  stances: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
  prepSeconds: z.number().int().min(60).max(3600),
}).refine(v => new Set(v.stances.map(s => s.toLowerCase())).size === v.stances.length,
  { message: "Each stance must have a different name." });

/** Inject a random source in tests; production uses Web Crypto. */
export function balancedAssignments<T>(students: readonly T[], stanceIds: readonly string[], random = () => {
  const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0] / 4294967296;
}): { student: T; stanceId: string }[] {
  if (stanceIds.length < 2 || stanceIds.length > 4) throw new Error("A debate needs 2–4 stances.");
  const shuffled = [...students];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sides = [...stanceIds];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  return shuffled.map((student, i) => ({ student, stanceId: sides[i % sides.length] }));
}

export function schoolDateTimeToIso(value: string, timezone = SCHOOL_TIMEZONE): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a date and time.");
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) throw new Error("Invalid date.");
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const rendered = formatter.format(new Date(instant)).replace(" ", "T");
    instant += target - Date.parse(`${rendered}:00Z`);
  }
  if (formatter.format(new Date(instant)).replace(" ", "T") !== value) throw new Error("This time does not exist due to daylight saving. Choose another time.");
  return new Date(instant).toISOString();
}
export function schoolDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: SCHOOL_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function schoolTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function programmeClass(p: string) { return p === "IB" ? "dp" : "national"; }

export interface DirectoryItem { id: string; name: string }
export interface Teacher { id: string; display_name: string }
export interface Config { departments: DirectoryItem[]; subjects: DirectoryItem[]; locations: DirectoryItem[]; teachers: Teacher[] }
export interface StudySession {
  id: string; programme: Programme; grade: string; focus: string; starts_at: string; ends_at: string;
  open_spots: number | null; host_name: string | null; contact: string | null;
  custom_location: string | null; subject: { name: string }; location: { name: string };
}
export interface Question {
  id: string; body: string; recipient_type: string; teacher_id: string | null; department_id: string | null;
  status: "new" | "answered" | "archived"; moderation_status: "approved" | "flagged";
  visibility: "private" | "public"; answer: string | null; answered_at: string | null;
  created_at: string; department?: { name: string } | null;
}
export interface Stance { id: string; label: string; position: number }
export interface Participant { id: string; display_name: string; stance_id: string | null }
export interface Debate {
  id: string; prompt: string; join_code: string; status: "lobby" | "assigned" | "ended";
  prep_seconds: number; timer_deadline: string | null; timer_remaining: number | null;
  expires_at: string; stances: Stance[]; participants?: Participant[];
}
