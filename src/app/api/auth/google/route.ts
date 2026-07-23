import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hostHeader = req.headers.get("host") || "localhost:3000";
  const protocol = hostHeader.includes("localhost") ? "http" : "https";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${hostHeader}`;
  const callbackUrl = `${baseUrl}/api/auth/google/callback`;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("Missing Google OAuth credentials in environment variables.");
    return NextResponse.redirect(`${baseUrl}/dashboard?error=missing_google_credentials`);
  }

  // We use prompt='consent' and access_type='offline' to force a refresh token
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    // Pass user ID in state so we can verify or use it if needed
    state: user.id,
    redirect_uri: callbackUrl
  });

  return NextResponse.redirect(url);
}
