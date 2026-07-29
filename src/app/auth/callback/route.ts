import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  // Determine the correct base URL
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  
  let baseUrl = requestUrl.origin;
  
  if (process.env.NODE_ENV !== "development") {
    if (forwardedHost) {
      baseUrl = `https://${forwardedHost}`;
    } else if (host) {
      baseUrl = `https://${host}`;
    } else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      baseUrl = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  // Return the user to login with error
  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_error`);
}
