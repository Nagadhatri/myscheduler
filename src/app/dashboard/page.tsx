import CalendarView from "@/components/owner/CalendarView";
import ScheduleManagement from "@/components/owner/ScheduleManagement";
import BookingRequestsPanel from "@/components/owner/BookingRequestsPanel";
import BookingHistory from "@/components/owner/BookingHistory";
import { DashboardProvider } from "@/components/owner/DashboardContext";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <CalendarView />
            <div className="h-[500px]">
              <ChatPanel context="owner" mode="inline" />
            </div>
            <BookingRequestsPanel />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <ScheduleManagement />
          </div>
          <div className="lg:col-span-3 space-y-6">
            <BookingHistory />
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
}
