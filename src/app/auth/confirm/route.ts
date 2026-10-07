import { NextRequest, NextResponse } from "next/server";
import { userSupabase } from "@/lib/supabase/server";
import { schoolAccess } from "@/lib/school-access";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash"), type = request.nextUrl.searchParams.get("type");
  if (token_hash && (type === "email" || type === "invite")) {
    const db = await userSupabase(); const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error) { const access = await schoolAccess(); return NextResponse.redirect(new URL(access?.role === "teacher" ? "/teacher" : "/", request.url)); }
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
