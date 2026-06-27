import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBooking() {
  const userId = "c8633b4b-267c-4e35-ac18-29acccfba479"; // Owner ID from previous test
  const date = "2026-06-25";
  const startTime = "10:00:00";
  const endTime = "11:00:00";
  const name = "Ritu";
  const email = "213087983ritu@gmail.com";
  const description = "Testing booking creation for Ritu";

  // Book it directly like the API does
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

  if (scheduleError) {
      console.log("Schedule Error:", scheduleError);
      return;
  }

  const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        schedule_id: scheduleData.id,
        visitor_name: name,
        visitor_email: email,
        description,
        booking_status: "Pending",
      })
      .select("id")
      .single();

  if (bookingError) {
      console.log("Booking Error:", bookingError);
      return;
  }

  console.log("Booking created successfully!");
}

testBooking();
