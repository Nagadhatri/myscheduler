import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBookingStatusEmail } from "@/lib/email";
import fs from "fs";
import path from "path";

// Add vercel cron security secret here if deployed
// const CRON_SECRET = process.env.CRON_SECRET;

function getServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (e) {}
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

export async function GET(req: Request) {
  // if (req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = getServiceRoleKey();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time in UTC
    const now = new Date();
    // We want to find meetings that start within the NEXT 1 hour
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    // We can't do complex date comparisons directly in standard Supabase easily if date/time are separate strings 
    // without using a view or postgres function, so we'll fetch today's accepted bookings and filter in JS
    
    // Get today's and tomorrow's date strings in case of timezone overlap
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, schedules!inner(*, profiles!owner_id(display_name, email))")
      .in("booking_status", ["Accepted", "Accepted with Remarks"])
      .eq("email_reminder_sent", false)
      .in("schedules.date", [today, tomorrow]);

    if (error) {
      console.error("Error fetching bookings for reminders:", error);
      return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ message: "No reminders to send" });
    }

    const sentIds = [];

    for (const booking of bookings) {
      const schedule = booking.schedules;
      const owner = schedule.profiles;
      
      // Construct meeting datetime (assuming schedule date and start_time are in UTC or same timezone)
      // Since our app doesn't save strict UTC timestamps, we'll treat them as UTC for the cron check
      // For a real production app, date+start_time should be saved as timestamp with time zone (timestamptz)
      const meetingDateTime = new Date(`${schedule.date}T${schedule.start_time}Z`);
      
      const timeDiffMs = meetingDateTime.getTime() - now.getTime();
      const timeDiffMinutes = timeDiffMs / (1000 * 60);

      // If the meeting starts in less than 65 minutes and is in the future
      if (timeDiffMinutes > 0 && timeDiffMinutes <= 65) {
        // Send email to visitor
        await sendBookingStatusEmail({
          to: booking.visitor_email,
          visitorName: booking.visitor_name,
          ownerName: owner.display_name,
          status: "Reminder",
          customHtml: `<p>Hi ${booking.visitor_name},</p>
            <p>This is a reminder that your meeting with <strong>${owner.display_name}</strong> is starting in about 1 hour.</p>
            <p><b>Meeting Details:</b><br/>
            - Date: ${schedule.date}<br/>
            - Time: ${schedule.start_time} - ${schedule.end_time}<br/>
            - Type: ${booking.meeting_type || 'Standard'}</p>
            <p>Looking forward to it!</p>
            <p>Best,<br/>MyScheduler Team</p>`,
        });

        sentIds.push(booking.id);
      }
    }

    if (sentIds.length > 0) {
      // Mark as sent
      await supabase
        .from("bookings")
        .update({ email_reminder_sent: true })
        .in("id", sentIds);
    }

    return NextResponse.json({ message: `Sent ${sentIds.length} reminders.` });
  } catch (error: any) {
    console.error("Cron reminders API error:", error);
    return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }
}
