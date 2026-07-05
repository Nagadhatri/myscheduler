import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Helper to get service key even if dev server hasn't been restarted
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
  } catch (e) {
    // ignore
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const date = searchParams.get("date"); // YYYY-MM-DD

    if (!userId || !date) {
      return NextResponse.json({ error: "Missing userId or date" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = getServiceRoleKey();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch schedules that have bookings for this user on this date
    const { data: schedules, error } = await supabase
      .from("schedules")
      .select("*, bookings(booking_status)")
      .eq("owner_id", userId)
      .eq("date", date)
      .eq("status", "Upcoming");

    if (error) throw error;

    // A slot is booked if there is an accepted booking
    const bookedTimes = (schedules || [])
      .filter((s: any) =>
        s.bookings?.some((b: any) =>
          ["Accepted", "Accepted with Remarks", "Pending"].includes(b.booking_status)
        )
      )
      .map((s: any) => s.start_time);

    // Generate all hourly slots from 5 AM to 11 PM
    const allSlots = [];
    for (let h = 5; h < 23; h++) {
      const st = `${String(h).padStart(2, "0")}:00:00`;
      const et = `${String(h + 1).padStart(2, "0")}:00:00`;
      if (!bookedTimes.includes(st)) {
        allSlots.push({
          time: `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`,
          date,
          start_time: st,
          end_time: et,
        });
      }
    }

    return NextResponse.json({ available_slots: allSlots, date });
  } catch (error: any) {
    console.error("Available slots API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
