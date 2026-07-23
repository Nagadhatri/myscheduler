import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const code = urlObj.searchParams.get('code');
  const error = urlObj.searchParams.get('error');

  if (error) {
    console.error("Google OAuth Error:", error);
    return NextResponse.redirect(`${urlObj.origin}/dashboard?error=google_oauth_error`);
  }

  if (!code) {
    return NextResponse.redirect(`${urlObj.origin}/dashboard?error=no_code`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${urlObj.origin}/login?error=unauthorized`);
  }

  try {
    const callbackUrl = `${urlObj.origin}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in Supabase
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token || null, // refresh_token might be undefined if not first time
        google_token_expiry: tokens.expiry_date,
      })
      .eq('id', user.id);

    if (dbError) {
      console.error("Failed to save tokens:", dbError);
      return NextResponse.redirect(`${urlObj.origin}/dashboard?error=db_error`);
    }

    return NextResponse.redirect(`${urlObj.origin}/dashboard?success=google_connected`);
  } catch (err) {
    console.error("Token exchange failed:", err);
    return NextResponse.redirect(`${urlObj.origin}/dashboard?error=token_exchange_failed`);
  }
}
