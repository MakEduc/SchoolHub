import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if ((request.nextUrl.pathname.startsWith("/teacher") || request.nextUrl.pathname.startsWith("/admin")) && !data.user) {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
export const config = { matcher: ["/teacher/:path*", "/admin/:path*", "/login", "/auth/:path*", "/api/:path*"] };
