import AvailabilityCalendar from "@/components/visitor/AvailabilityCalendar";
import PastBookingLookup from "@/components/visitor/PastBookingLookup";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function VisitorPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex flex-col md:flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight mb-4 md:mb-0">Book an Appointment</h1>
        <div className="w-full md:w-auto">
          <PastBookingLookup />
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-6 mt-8">
        <AvailabilityCalendar />
      </main>
      
      <ChatPanel context="visitor" />
    </div>
  );
}
