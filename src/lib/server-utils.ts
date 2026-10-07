import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminSupabase, userSupabase } from "./supabase/server";
import { isAllowedRequestOrigin } from "./request-origin";

export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function dbError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (["PGRST205", "PGRST202", "42P01"].includes(error.code || "")) throw new ApiError("Your school's tools are being connected. Please try again shortly.", 503);
  if (error.code === "23503") throw new ApiError("That selection is no longer available. Refresh and choose again.");
  if (error.code === "23505") throw new ApiError("This already exists. Try a different name or reload.", 409);
  throw new ApiError("The request could not be completed. Please try again.", 500);
}
export async function readBody(request: NextRequest): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (!isAllowedRequestOrigin(origin, request.url, request.headers.get("host"), process.env.NEXT_PUBLIC_SITE_URL)) {
    throw new ApiError("Request origin is not allowed.", 403);
  }
  if (Number(request.headers.get("content-length") || "0") > 16384) throw new ApiError("Request is too large.", 413);
  const text = await request.text();
  if (text.length > 16384) throw new ApiError("Request is too large.", 413);
  try { return JSON.parse(text); } catch { throw new ApiError("Invalid request."); }
}
export async function staff() {
  const db = await userSupabase();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user?.email_confirmed_at) throw new ApiError("Please sign in as a teacher.", 401);
  const result = await db.from("teacher_profiles").select("id,display_name,role,handles_general,school_id").eq("id", user.id).eq("active", true).maybeSingle();
  dbError(result.error);
  if (!result.data) throw new ApiError("Your account does not have teacher access.", 403);
  const domain = await adminSupabase().from("school_domains").select("school_id,school:schools!inner(active)").eq("domain", user.email!.split("@")[1].toLowerCase()).eq("school_id", result.data.school_id).eq("school.active", true).maybeSingle();
  dbError(domain.error); if (!domain.data) throw new ApiError("Your account does not have school access.", 403);
  return { db, user, profile: result.data as { id: string; display_name: string; role: string; handles_general: boolean; school_id: string } };
}
export async function rateLimit(request: NextRequest, action: string, max = 8, seconds = 600, networkMax = Math.max(300, max * 10)) {
  // Only trust the hosting provider's client IP header; localhost shares a development bucket.
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0] || "unknown" : "development";
  const store = await cookies();
  let browser = store.get("schoolhub_submission_limit")?.value;
  if (!browser || !/^[a-f0-9]{64}$/.test(browser)) {
    browser = token(); store.set("schoolhub_submission_limit", browser, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 3600, path: "/" });
  }
  const keyFor = (value: string) => createHmac("sha256", process.env.SUPABASE_SECRET_KEY!).update(`${action}:${value}`).digest("hex");
  // Browser limits preserve capacity for many students sharing one school Wi-Fi IP.
  const result = await adminSupabase().rpc("consume_rate_limit", { p_key: keyFor(browser), p_max: max, p_seconds: seconds });
  dbError(result.error);
  if (!result.data) throw new ApiError("You've made several submissions. Please wait a few minutes and try again.", 429);
  const network = await adminSupabase().rpc("consume_rate_limit", { p_key: keyFor(`network:${ip}`), p_max: networkMax, p_seconds: seconds });
  dbError(network.error);
  if (!network.data) throw new ApiError("The school is receiving many submissions. Please try again shortly.", 429);
}
export const token = () => randomBytes(32).toString("hex");
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const uuid = z.uuid();
export function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } }); }
export function failure(error: unknown) {
  if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message || "Please check your entries." }, 400);
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error("SchoolHub request failed:", error instanceof Error ? error.name : "Unknown error");
  return json({ error: "Something went wrong. Please try again." }, 500);
}
export function isFlagged(text: string) {
  const normalized = text.toLowerCase().normalize("NFKD").replace(/[013@$]/g, c => ({ "0": "o", "1": "i", "3": "e", "@": "a", "$": "s" })[c] || c);
  return /\b(fuck\w*|shit\w*|bitch\w*|cunt\w*|asshole\w*|nigger\w*|faggot\w*)\b/i.test(normalized);
}
