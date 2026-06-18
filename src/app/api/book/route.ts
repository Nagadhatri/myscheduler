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

    // Verify acquaintance status: visitor must be connected to the host
    const { data: visitorProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Profile query error:", profileError);
      return NextResponse.json({ error: "Failed to verify visitor credentials" }, { status: 500 });
    }

    if (!visitorProfile) {
      return NextResponse.json(
        { error: "Only registered acquaintances can book appointments. Please ask the owner to send you a connection request or register first." },
        { status: 403 }
      );
    }

    const { data: connections, error: connError } = await supabase
      .from("connections")
      .select("requester_id, receiver_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${visitorProfile.id},receiver_id.eq.${visitorProfile.id}`);

    if (connError) {
      console.error("Connection query error:", connError);
      return NextResponse.json({ error: "Failed to verify connection status" }, { status: 500 });
    }

    const isConnected = (connections || []).some(
      (c: any) =>
        (c.requester_id === visitorProfile.id && c.receiver_id === userId) ||
        (c.requester_id === userId && c.receiver_id === visitorProfile.id)
    );

    if (!isConnected) {
      return NextResponse.json(
        { error: "You must be an accepted acquaintance/friend of the host beforehand to book a meeting. Please request a connection first." },
        { status: 403 }
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

    // 3. Create the booking request
    const { error: bookingError } = await supabase
      .from("bookings")
      .insert({
        schedule_id: scheduleData.id,
        visitor_name: name,
        visitor_email: email,
        description,
        booking_status: "Pending",
      });

    if (bookingError) throw bookingError;

    // 4. Fetch owner profile to send notification email
    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", userId)
      .single();

    if (!ownerError && ownerProfile) {
      // Send notification to owner
      await sendEmailWebhook({
        to: ownerProfile.email,
        subject: `New Booking Request from ${name}`,
        body: `Hi ${ownerProfile.display_name},\n\nYou have received a new booking request from ${name} (${email}).\n\nMeeting Details:\n- Date: ${date}\n- Time: ${startTime} - ${endTime}\n- Description: ${description}\n\nPlease log in to your MyScheduler Dashboard to accept or reject this request.\n\nBest,\nMyScheduler Team`,
      });

      // Send confirmation to visitor
      await sendEmailWebhook({
        to: email,
        subject: `Booking Request Submitted - MyScheduler`,
        body: `Hi ${name},\n\nYour booking request with ${ownerProfile.display_name} has been submitted successfully!\n\nMeeting Details:\n- Date: ${date}\n- Time: ${startTime} - ${endTime}\n- Description: ${description}\n\nYou will receive another email once the host responds to your request.\n\nBest,\nMyScheduler Team`,
      });
    }

    return NextResponse.json({ success: true, message: "Booking request submitted successfully" });
  } catch (error: any) {
    console.error("Public booking API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
