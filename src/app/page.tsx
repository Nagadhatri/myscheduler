import AvailabilityCalendar from "@/components/visitor/AvailabilityCalendar";
import PastBookingLookup from "@/components/visitor/PastBookingLookup";
import ChatPanel from "@/components/chatbot/ChatPanel";
import { CalendarDays, Sparkles } from "lucide-react";

export default function VisitorPage() {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-[var(--status-upcoming)]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-[var(--status-completed)]/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-card/50 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight gradient-text">
              MyScheduler
            </h1>
            <p className="text-xs text-muted-foreground -mt-0.5">
              Book your next appointment
            </p>
          </div>
        </div>
        <PastBookingLookup />
      </header>

      {/* Hero */}
      <section className="relative z-10 text-center py-12 px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary mb-4">
          <Sparkles className="w-3 h-3" />
          Quick & Easy Scheduling
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Find a time that works
          <span className="gradient-text"> for you</span>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Select a date, pick an available slot, and submit your booking
          request in seconds.
        </p>
      </section>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <AvailabilityCalendar />
      </main>

      <ChatPanel context="visitor" />
    </div>
  );
}
