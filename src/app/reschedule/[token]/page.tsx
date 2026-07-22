import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import RescheduleClient from "./RescheduleClient";

export default async function ReschedulePage({ params }: { params: { token: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Read service role from .env directly since this runs on Node.js
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
    try {
      const fs = require('fs');
      const envPath = require('path').resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
        if (match && match[1]) {
          supabaseKey = match[1].trim();
        }
      }
    } catch (e) {}
  }
  
  if (!supabaseKey) supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*, schedules(*)")
    .eq("reschedule_token", params.token)
    .single();

  if (error || !booking) {
    return notFound();
  }

  // Fetch the owner profile to get timezone, buffer times, etc.
  const { data: owner } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", booking.schedules.owner_id)
    .single();

  if (!owner) {
    return notFound();
  }

  // Fetch existing schedules for the next 30 days to block out booked slots
  const { data: schedules } = await supabase
    .from("schedules")
    .select("date, start_time, status")
    .eq("owner_id", booking.schedules.owner_id)
    .gte("date", new Date().toISOString().split('T')[0]);

  return <RescheduleClient booking={booking} owner={owner} token={params.token} bookedSlots={schedules || []} />;
}
