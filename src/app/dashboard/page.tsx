import CalendarView from "@/components/owner/CalendarView";
import ScheduleManagement from "@/components/owner/ScheduleManagement";
import BookingHistory from "@/components/owner/BookingHistory";
import { DashboardProvider } from "@/components/owner/DashboardContext";
import ChartHistoryButton from "@/components/owner/ChartHistoryButton";
import OwnerChatPanelWrapper from "@/components/chatbot/OwnerChatPanelWrapper";

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <CalendarView />
            <BookingHistory />
            <ChartHistoryButton />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <ScheduleManagement />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <OwnerChatPanelWrapper />
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
}
