import { NextRequest, NextResponse } from "next/server";
import { userSupabase } from "@/lib/supabase/server";
import { schoolAccess } from "@/lib/school-access";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) { const db = await userSupabase(); const { error } = await db.auth.exchangeCodeForSession(code); if (!error) { const access = await schoolAccess(); return NextResponse.redirect(new URL(access?.role === "teacher" ? "/teacher" : "/", request.url)); } }
  return NextResponse.redirect(new URL("/login", request.url));
}
