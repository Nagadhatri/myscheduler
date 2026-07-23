import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, Clock } from "lucide-react";

export default async function DashboardMetrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. How many meetings did I have this month?
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0,0,0,0);
  
  const { data: monthMeetings } = await supabase
    .from("schedules")
    .select("id")
    .eq("owner_id", user.id)
    .gte("date", startOfMonth.toISOString().split("T")[0]);

  const meetingsThisMonth = monthMeetings?.length || 0;

  // 2. Who is my most frequent visitor? & 3. How many hours did I spend in meetings this week?
  const { data: profile } = await supabase
    .from("profiles")
    .select("google_refresh_token, google_access_token")
    .eq("id", user.id)
    .single();

  const isGoogleConnected = !!(profile?.google_refresh_token || profile?.google_access_token);

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("visitor_email, visitor_name, schedules!inner(date, start_time, end_time, owner_id)")
    .eq("schedules.owner_id", user.id)
    .in("booking_status", ["Accepted", "Accepted with Remarks"]);

  let mostFrequentVisitor = "None";
  let hoursThisWeek = 0;

  if (bookingsData && bookingsData.length > 0) {
    const visitorCounts: Record<string, {name: string, count: number}> = {};
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

    bookingsData.forEach((b: any) => {
      // Count visitors
      if (!visitorCounts[b.visitor_email]) {
        visitorCounts[b.visitor_email] = { name: b.visitor_name, count: 0 };
      }
      visitorCounts[b.visitor_email].count++;

      // Count hours this week
      if (b.schedules.date >= oneWeekAgoStr) {
        const start = new Date(`1970-01-01T${b.schedules.start_time}Z`);
        const end = new Date(`1970-01-01T${b.schedules.end_time}Z`);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        hoursThisWeek += hours;
      }
    });

    let maxCount = 0;
    for (const email in visitorCounts) {
      if (visitorCounts[email].count > maxCount) {
        maxCount = visitorCounts[email].count;
        mostFrequentVisitor = visitorCounts[email].name;
      }
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {isGoogleConnected ? (
          <div className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm flex items-center gap-2">
            ✅ Google Calendar Connected
          </div>
        ) : (
          <a href="/api/auth/google" className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 rounded-lg text-sm flex items-center gap-2 transition">
            <CalendarCheck className="w-4 h-4" />
            Connect Google Calendar
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Meetings this Month</CardTitle>
          <CalendarCheck className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{meetingsThisMonth}</div>
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Hours this Week</CardTitle>
          <Clock className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{hoursThisWeek.toFixed(1)}h</div>
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Visitor</CardTitle>
          <Users className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold truncate" title={mostFrequentVisitor}>{mostFrequentVisitor}</div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
