import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmailWebhook } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { slotId, newDate, newStartTime, newEndTime, reason } = await req.json();

    if (!slotId || !newDate || !newStartTime || !newEndTime || !reason) {
      return NextResponse.json({ error: "Missing required rescheduling details" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch the old schedule slot details
    const { data: oldSlot, error: fetchSlotError } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", slotId)
      .single();

    if (fetchSlotError || !oldSlot) {
      return NextResponse.json({ error: "Schedule slot not found" }, { status: 404 });
    }

    // 2. Fetch any associated booking on the old slot
    const { data: booking, error: fetchBookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("schedule_id", slotId)
      .maybeSingle();

    if (fetchBookingError) {
      console.error("Booking search error:", fetchBookingError);
    }

    // 3. Mark old slot status as Rescheduled
    const { error: updateOldError } = await supabase
      .from("schedules")
      .update({ status: "Rescheduled" })
      .eq("id", slotId);

    if (updateOldError) throw updateOldError;

    // 4. Create the new schedule slot
    const { data: newSlot, error: insertError } = await supabase
      .from("schedules")
      .insert({
        title: oldSlot.title,
        category: oldSlot.category,
        description: oldSlot.description,
        date: newDate,
        start_time: newStartTime.length === 5 ? newStartTime + ":00" : newStartTime,
        end_time: newEndTime.length === 5 ? newEndTime + ":00" : newEndTime,
        status: "Upcoming",
        owner_id: oldSlot.owner_id,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    let emailSent = false;

    // 5. Update the booking if it exists to point to the new schedule slot
    if (booking && newSlot) {
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({
          schedule_id: newSlot.id,
          booking_status: "Rescheduled",
          owner_remarks: `Rescheduled: ${reason}`,
        })
        .eq("id", booking.id);

      if (bookingUpdateError) throw bookingUpdateError;

      // 6. Fetch the host's profile
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", oldSlot.owner_id)
        .single();

      const ownerName = ownerProfile?.display_name || "Host";
      const ownerEmail = ownerProfile?.email || "";

      // 7. Send notification email to the visitor
      try {
        await sendEmailWebhook({
          to: booking.visitor_email,
          subject: `Meeting Rescheduled - MyScheduler`,
          body: `Hi ${booking.visitor_name},\n\nYour meeting with ${ownerName} (${ownerEmail}) has been rescheduled.\n\nRescheduled Details:\n- New Date: ${newDate}\n- New Time: ${newStartTime} - ${newEndTime}\n\nReason for Rescheduling:\n${reason}\n\nAre you okay with this rescheduled time? If not, you can rearrange your booking slot to the required time of your desire by visiting the visitor portal.\n\nBest,\nMyScheduler Team`,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("Failed to send rescheduling email:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: booking
        ? `Meeting rescheduled. Email notification sent to ${booking.visitor_name}.`
        : "Slot rescheduled successfully.",
      emailSent,
    });
  } catch (error: any) {
    console.error("Reschedule API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
