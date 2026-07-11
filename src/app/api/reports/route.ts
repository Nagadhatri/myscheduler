import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const reportType = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") || "20");

  let query = supabase
    .from("reports")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (reportType) {
    query = query.eq("report_type", reportType);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }

  return NextResponse.json({ reports: data || [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!genAI) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { reportType, dateFrom, dateTo } = body;

  if (!reportType || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "reportType, dateFrom, dateTo are required" }, { status: 400 });
  }

  try {
    // 1. Fetch schedules in the date range
    const { data: schedules } = await supabase
      .from("schedules")
      .select("*")
      .eq("owner_id", user.id)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    // 2. Fetch meeting minutes for those schedules
    const scheduleIds = (schedules || []).map((s: any) => s.id);
    let minutes: any[] = [];
    if (scheduleIds.length > 0) {
      const { data: momData } = await supabase
        .from("meeting_minutes")
        .select("*")
        .in("schedule_id", scheduleIds);
      minutes = momData || [];
    }

    // 3. Fetch bookings for those schedules
    let bookings: any[] = [];
    if (scheduleIds.length > 0) {
      const { data: bookingData } = await supabase
        .from("bookings")
        .select("*")
        .in("schedule_id", scheduleIds);
      bookings = bookingData || [];
    }

    // 4. Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .single();

    // 5. Build AI prompt
    const pageGuidance = reportType === "daily"
      ? "Generate a concise 1-2 page daily report."
      : reportType === "weekly"
        ? "Generate a detailed report up to 5 pages covering the full week."
        : reportType === "monthly"
          ? "Generate a comprehensive monthly report with trends and insights."
          : "Generate a detailed report for the custom date range.";

    const prompt = `You are a professional report generator for a scheduling/meeting management platform.

${pageGuidance}

**User**: ${profile?.display_name || "User"} (${profile?.email || ""})
**Report Period**: ${dateFrom} to ${dateTo}
**Report Type**: ${reportType}

**Schedules (${(schedules || []).length} total)**:
${(schedules || []).map((s: any) => `- ${s.date} | ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)} | ${s.title} (${s.category}) [${s.status}]${s.description ? ` — ${s.description}` : ""}`).join("\n") || "No schedules found."}

**Bookings (${bookings.length} total)**:
${bookings.map((b: any) => `- ${b.visitor_name} (${b.visitor_email}) — Status: ${b.booking_status}${b.owner_remarks ? ` | Remarks: ${b.owner_remarks}` : ""}`).join("\n") || "No bookings found."}

**Minutes of Meeting (${minutes.length} total)**:
${minutes.map((m: any) => {
  const schedule = (schedules || []).find((s: any) => s.id === m.schedule_id);
  return `- [${schedule?.title || "Meeting"}] ${schedule?.date || ""}: ${m.content}`;
}).join("\n") || "No minutes recorded."}

Generate the report in clean Markdown format with:
1. **Executive Summary** — Brief overview
2. **Meetings & Events** — List of all meetings with details
3. **Key Decisions & Action Items** — Extracted from minutes
4. **Time Analysis** — How time was spent across categories
5. **Recommendations** — Any suggestions for improvement

Use professional language. Be concise but thorough.`;

    // 6. Generate report with Gemini
    let reportContent = "";
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    reportContent = response.text?.trim() || "";

    if (!reportContent) {
       reportContent = "Failed to generate report.";
    }

    // 7. Save to database
    const { data: savedReport, error: saveError } = await supabase
      .from("reports")
      .insert({
        owner_id: user.id,
        report_type: reportType,
        date_from: dateFrom,
        date_to: dateTo,
        content: reportContent,
      })
      .select()
      .single();

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({ report: savedReport });
  } catch (error: any) {
    console.error("Report generation error:", error);
    let cleanMsg = "Failed to generate report";
    try {
      const errObj = JSON.parse(error.message);
      if (errObj.error && errObj.error.message) {
        cleanMsg = errObj.error.message;
      }
    } catch {
      cleanMsg = error.message?.substring(0, 200) || cleanMsg;
    }
    return NextResponse.json({ error: cleanMsg }, { status: 500 });
  }
}
