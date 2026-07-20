import CalendarView from "@/components/owner/CalendarView";
import ScheduleManagement from "@/components/owner/ScheduleManagement";
import BookingHistoryButton from "@/components/owner/BookingHistoryButton";
import ReportsPanel from "@/components/owner/ReportsPanel";
import { DashboardProvider } from "@/components/owner/DashboardContext";
import OwnerChatPanelWrapper from "@/components/chatbot/OwnerChatPanelWrapper";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | MyScheduler",
  description: "Manage your schedule and bookings.",
  openGraph: {
    title: "Dashboard | MyScheduler",
    description: "Manage your schedule and bookings.",
  },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <CalendarView />
          <div className="space-y-3 pt-2">
            <BookingHistoryButton />
            <ReportsPanel />
          </div>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <ScheduleManagement />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <OwnerChatPanelWrapper />
        </div>
      </div>
    </div>
  );
}
