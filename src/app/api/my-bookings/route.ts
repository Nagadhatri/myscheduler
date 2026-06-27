import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const ownerId = searchParams.get("ownerId");

    if (!email) {
      return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { data: bookings, error } = await query;

    if (error) throw error;

    let enrichedBookings = bookings || [];

    if (enrichedBookings.length > 0) {
      const ownerIds = Array.from(new Set(enrichedBookings.map((b: any) => b.schedule?.owner_id).filter(Boolean)));
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, occupation")
          .in("id", ownerIds);
        
        const profileMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        enrichedBookings = enrichedBookings.map((b: any) => {
          if (b.schedule) {
            b.schedule.owner = profileMap[b.schedule.owner_id] || null;
          }
          return b;
        });
      }
    }

    return NextResponse.json({ bookings: enrichedBookings });
  } catch (error: any) {
    console.error("My bookings fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
