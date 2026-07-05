import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmailWebhook } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { userId, date, startTime, endTime, name, email, description } = await req.json();

    if (!userId || !date || !startTime || !endTime || !name || !email || !description) {
      return NextResponse.json({ error: "Missing required booking details" }, { status: 400 });
    }

    if (description.length < 10) {
      return NextResponse.json({ error: "Description must be at least 10 characters long" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if visitor is a registered user
    const { data: visitorProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // Determine if visitor is an acquaintance (connected to the owner)
    let isConnected = false;
    if (visitorProfile) {
      const { data: connections } = await supabase
        .from("connections")
        .select("requester_id, receiver_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${visitorProfile.id},receiver_id.eq.${visitorProfile.id}`);

      isConnected = (connections || []).some(
        (c: any) =>
          (c.requester_id === visitorProfile.id && c.receiver_id === userId) ||
          (c.requester_id === userId && c.receiver_id === visitorProfile.id)
      );
    }

    // 1. Check if the slot is already booked
    const { data: existingSchedules, error: checkError } = await supabase
      .from("schedules")
      .select("*, bookings(booking_status)")
      .eq("owner_id", userId)
      .eq("date", date)
      .eq("start_time", startTime)
      .eq("status", "Upcoming");

    if (checkError) throw checkError;

    const isBooked = (existingSchedules || []).some((s: any) =>
      s.bookings?.some((b: any) =>
        ["Accepted", "Accepted with Remarks", "Pending"].includes(b.booking_status)
      )
    );

    if (isBooked) {
      return NextResponse.json({ error: "This slot is already booked or has a pending request" }, { status: 409 });
    }

    // 2. Create the schedule slot
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("schedules")
      .insert({
        title: `Booking by ${name}`,
        category: "Meeting",
        date,
        start_time: startTime,
        end_time: endTime,
        status: "Upcoming",
        owner_id: userId,
      })
      .select("id")
      .single();

    if (scheduleError) throw scheduleError;

    // Both connected and non-connected visitors get "Pending" status
    const bookingStatus = "Pending";

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        schedule_id: scheduleData.id,
        visitor_name: name,
        visitor_email: email,
        description,
        booking_status: bookingStatus,
      })
      .select("id")
      .single();

    if (bookingError) throw bookingError;

    // 4. Fetch owner profile to send notification email
    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", userId)
      .single();

    if (!ownerError && ownerProfile) {
      const hostHeader = req.headers.get("host") || "localhost:3000";
      const protocol = hostHeader.includes("localhost") ? "http" : "https";
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${hostHeader}`;
      const actionBaseUrl = `${baseUrl}/dashboard/action/${bookingData.id}`;
      const actionLinks = `
Quick Actions:
✅ Accept Request: ${actionBaseUrl}?action=Accepted
❌ Reject Request: ${actionBaseUrl}?action=Rejected
`;

      if (isConnected) {
        // Normal notification for acquaintances
        await sendEmailWebhook({
          to: ownerProfile.email,
          subject: `New Booking Request from ${name}`,
          body: `Dear ${ownerProfile.display_name},\n\n${name} has requested to book a slot with you. Kindly confirm whether you would like to accept their request.\n\nMeeting Details:\n- Date: ${date}\n- Time: ${startTime} - ${endTime}\n- Description: ${description}\n\n${actionLinks}\nBest regards,\nMyScheduler Team`,
        });
      } else {
        // Special notification for non-acquaintances — owner must approve first
        await sendEmailWebhook({
          to: ownerProfile.email,
          subject: `⚠️ Booking Request from Unknown Person: ${name}`,
          body: `Dear ${ownerProfile.display_name},\n\n${name} (who is NOT in your contacts) has requested to book a slot with you. Kindly confirm whether you would like to accept their request.\n\nMeeting Details:\n- Date: ${date}\n- Time: ${startTime} - ${endTime}\n- Description: ${description}\n\n${actionLinks}\nBest regards,\nMyScheduler Team`,
        });
      }

      // Send confirmation to visitor
      const statusMessage = isConnected
        ? "Your booking request has been submitted successfully!"
        : "Your booking request has been submitted. Since you are not yet connected with this person, they will need to approve your request first.";

      await sendEmailWebhook({
        to: email,
        subject: `Booking Request Submitted - MyScheduler`,
        body: `Hi ${name},\n\n${statusMessage}\n\nMeeting Details:\n- Date: ${date}\n- Time: ${startTime} - ${endTime}\n- Description: ${description}\n\nYou will receive another email once the host responds to your request.\n\nBest,\nMyScheduler Team`,
      });
    }

    const successMessage = isConnected
      ? "Booking request submitted successfully!"
      : "Booking request submitted! Since you're not yet connected with this person, they'll need to approve your request first.";

    return NextResponse.json({ success: true, message: successMessage });
  } catch (error: any) {
    console.error("Public booking API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
