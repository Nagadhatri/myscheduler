import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBookingStatusEmail } from "@/lib/email";
import fs from "fs";
import path from "path";

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

export async function POST(req: Request) {
  try {
    const { token, newDate, newStartTime, newEndTime } = await req.json();

    if (!token || !newDate || !newStartTime || !newEndTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = getServiceRoleKey();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find the booking by token
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*, schedules(*)")
      .eq("reschedule_token", token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Invalid or expired reschedule token" }, { status: 404 });
    }

    // 2. Check if the new slot is available
    const { data: existingSchedules } = await supabase
      .from("schedules")
      .select("*, bookings(booking_status)")
      .eq("owner_id", booking.schedules.owner_id)
      .eq("date", newDate)
      .eq("start_time", newStartTime);

    const isBooked = (existingSchedules || []).some((s: any) =>
      s.bookings?.some((b: any) =>
        ["Accepted", "Accepted with Remarks", "Pending"].includes(b.booking_status)
      ) && s.id !== booking.schedule_id // allow if it's the current slot being rescheduled
    );

    if (isBooked) {
      return NextResponse.json({ error: "This slot is already booked." }, { status: 409 });
    }

    // 3. Update the schedule (if we just move the time of the existing schedule, it handles it easily)
    const { error: updateError } = await supabase
      .from("schedules")
      .update({
        date: newDate,
        start_time: newStartTime,
        end_time: newEndTime,
      })
      .eq("id", booking.schedule_id);

    if (updateError) throw updateError;

    // Fetch the owner profile to send emails
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", booking.schedules.owner_id)
      .single();

    if (ownerProfile) {
      // Notify Owner
      await sendBookingStatusEmail({
        to: ownerProfile.email,
        visitorName: booking.visitor_name,
        ownerName: ownerProfile.display_name,
        status: "Rescheduled",
        customHtml: `<p>Dear ${ownerProfile.display_name},</p><p><strong>${booking.visitor_name}</strong> has rescheduled their meeting with you using the self-serve link.</p><p><b>Old Time:</b> ${booking.schedules.date} at ${booking.schedules.start_time}<br/><b>New Time:</b> ${newDate} at ${newStartTime} - ${newEndTime}</p><p>Best regards,<br/>MyScheduler Team</p>`,
      });

      // Notify Visitor
      const hostHeader = req.headers.get("host") || "localhost:3000";
      const protocol = hostHeader.includes("localhost") ? "http" : "https";
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${hostHeader}`;
      const rescheduleUrl = `${baseUrl}/reschedule/${token}`;

      await sendBookingStatusEmail({
        to: booking.visitor_email,
        visitorName: booking.visitor_name,
        ownerName: ownerProfile.display_name,
        status: "Rescheduled",
        customHtml: `<p>Hi ${booking.visitor_name},</p><p>Your meeting has been successfully rescheduled to <b>${newDate} at ${newStartTime}</b>.</p><p>Need to change the time again? <a href="${rescheduleUrl}">Click here to reschedule</a></p><p>Best,<br/>MyScheduler Team</p>`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reschedule Token API error:", error);
    return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }
}
