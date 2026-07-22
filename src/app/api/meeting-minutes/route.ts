import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");

  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meeting_minutes")
    .select("*")
    .eq("schedule_id", scheduleId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }

  return NextResponse.json({ minutes: data?.[0] || null });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { scheduleId, content, source } = body;

  if (!scheduleId || !content) {
    return NextResponse.json({ error: "scheduleId and content are required" }, { status: 400 });
  }

  // Check if minutes already exist for this schedule
  const { data: existing } = await supabase
    .from("meeting_minutes")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("owner_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    // Update existing
    const { data, error } = await supabase
      .from("meeting_minutes")
      .update({
        content,
        source: source || "manual",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing[0].id)
      .select()
      .single();

    if (error) {
      console.error("Update meeting_minutes error:", error);
      return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
    }
    return NextResponse.json({ minutes: data, updated: true });
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("meeting_minutes")
      .insert({
        schedule_id: scheduleId,
        owner_id: user.id,
        content,
        source: source || "manual",
      })
      .select()
      .single();

    if (error) {
      console.error("Insert meeting_minutes error:", error);
      return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
    }
    return NextResponse.json({ minutes: data, created: true });
  }
}
