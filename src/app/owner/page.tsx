import CalendarView from "@/components/owner/CalendarView";
import ScheduleManagement from "@/components/owner/ScheduleManagement";
import BookingRequestsPanel from "@/components/owner/BookingRequestsPanel";
import BookingHistory from "@/components/owner/BookingHistory";
import { DashboardProvider } from "@/components/owner/DashboardContext";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function OwnerDashboardPage() {
  return (
    <DashboardProvider>
      <div className="p-6 h-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* Left Panel: Calendar */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          <CalendarView />
        </div>

        {/* Middle Panel: Schedule Management */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          <ScheduleManagement />
        </div>

        {/* Right Panel: Bookings */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          <BookingRequestsPanel />
          <BookingHistory />
        </div>
      </div>
      </div>
      <ChatPanel context="owner" />
    </DashboardProvider>
  );
}
