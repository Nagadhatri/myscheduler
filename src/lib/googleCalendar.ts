import { google } from 'googleapis';

export async function getGoogleAuthClient(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId)
    .single();

  if (!profile || (!profile.google_access_token && !profile.google_refresh_token)) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: profile.google_access_token,
    refresh_token: profile.google_refresh_token,
    expiry_date: profile.google_token_expiry ? Number(profile.google_token_expiry) : undefined,
  });

  oauth2Client.on('tokens', async (tokens) => {
    const updateData: any = {
      google_access_token: tokens.access_token,
      google_token_expiry: tokens.expiry_date,
    };
    if (tokens.refresh_token) {
      updateData.google_refresh_token = tokens.refresh_token;
    }
    // Update the tokens in Supabase
    await supabase.from('profiles').update(updateData).eq('id', userId);
  });

  return oauth2Client;
}

export async function getBusyTimes(supabase: any, userId: string, timeMin: string, timeMax: string) {
  const auth = await getGoogleAuthClient(supabase, userId);
  if (!auth) return [];

  const calendar = google.calendar({ version: 'v3', auth });
  
  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    return res.data.calendars?.primary?.busy || [];
  } catch (err) {
    console.error("Error fetching Google Calendar busy times:", err);
    return [];
  }
}

export async function createGoogleEvent(supabase: any, userId: string, eventDetails: any) {
  const auth = await getGoogleAuthClient(supabase, userId);
  if (!auth) return null;

  const calendar = google.calendar({ version: 'v3', auth });
  
  const event = {
    summary: eventDetails.title || 'Meeting',
    description: eventDetails.description || '',
    start: {
      dateTime: eventDetails.startTime, // Should be YYYY-MM-DDTHH:mm:ss
      timeZone: eventDetails.timezone || 'UTC',
    },
    end: {
      dateTime: eventDetails.endTime,
      timeZone: eventDetails.timezone || 'UTC',
    },
    attendees: [
      { email: eventDetails.visitorEmail }
    ]
  };

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all'
    });
    return res.data;
  } catch (err) {
    console.error("Error creating Google Calendar event:", err);
    return null;
  }
}
