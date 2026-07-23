import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendBookingStatusEmail } from "@/lib/email";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createGoogleEvent } from "@/lib/googleCalendar";

export async function POST(req: Request) {
  try {
    const { bookingId, status, remarks } = await req.json();

    if (!bookingId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use server client to verify the user is logged in
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role key to do the update since RLS might not be configured perfectly, 
    // but we will verify owner_id matches user.id first.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseKey);

    // Get the booking and its schedule to verify ownership
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from("bookings")
      .select("*, schedule:schedules(*)")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.schedule.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized to modify this booking" }, { status: 403 });
    }

    // Update the booking
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        booking_status: status,
        owner_remarks: remarks || "",
        action_timestamp: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      throw updateError;
    }
    
    // Fetch owner profile to get timezone
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, timezone")
      .eq("id", user.id)
      .single();

    if (status.startsWith("Accepted")) {
       try {
         await createGoogleEvent(supabaseAdmin, user.id, {
           title: booking.schedule.title,
           description: booking.description,
           startTime: `${booking.schedule.date}T${booking.schedule.start_time}`,
           endTime: `${booking.schedule.date}T${booking.schedule.end_time}`,
           visitorEmail: booking.visitor_email,
           timezone: ownerProfile?.timezone || 'UTC'
         });
       } catch (err) {
         console.error("Failed to push to Google Calendar", err);
       }
    }

    // Send email to visitor
    const visitorEmail = booking.visitor_email;
    const visitorName = booking.visitor_name;
    const ownerName = user.user_metadata?.display_name || "The host";

    await sendBookingStatusEmail({
      to: visitorEmail,
      visitorName,
      ownerName,
      status,
      remarks,
    });
    
    // Attempt to find the visitor in profiles to send an in-app notification
    const { data: visitorProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", visitorEmail)
      .maybeSingle();

    if (visitorProfile) {
      await supabaseAdmin.from("notifications").insert({
        user_id: visitorProfile.id,
        type: `booking_${status.toLowerCase()}`,
        title: `Booking Request ${status}`,
        message: `${ownerName} has ${status.toLowerCase()} your request for ${booking.schedule.date}.`,
        related_id: bookingId,
      });
    }

    return NextResponse.json({ success: true, message: `Booking ${status.toLowerCase()} successfully.` });
  } catch (error: any) {
    console.error("Booking action API error:", error);
    return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }
}
