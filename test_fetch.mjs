import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = "nagadhatritirumalasetty@gmail.com";
  const ownerId = "c8633b4b-267c-4e35-ac18-29acccfba479";
  
  let query = supabase
      .from("bookings")
      .select(`
        id,
        booking_status,
        description,
        owner_remarks,
        schedule:schedules${ownerId ? '!inner' : ''} (
          title,
          date,
          start_time,
          end_time,
          owner_id
        )
      `)
      .eq("visitor_email", email)
      .order("created_at", { ascending: false });

  if (ownerId) {
      query = query.eq("schedule.owner_id", ownerId);
  }

  const { data: bookings, error: err1 } = await query;
  console.log("Bookings:", JSON.stringify(bookings, null, 2));
  if (err1) console.error(err1);
}

test();
