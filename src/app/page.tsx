import Link from "next/link";
import { CalendarDays, Users, Sparkles, ArrowRight, Shield, UserCheck, Settings } from "lucide-react";
import ChatPanel from "@/components/chatbot/ChatPanel";
import PastBookingLookup from "@/components/visitor/PastBookingLookup";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative flex flex-col justify-between">
      {/* Background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[var(--status-upcoming)]/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-card/50 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-bold tracking-tight gradient-text">MyScheduler</h1>
        </div>
        <div className="flex items-center gap-3">
          <PastBookingLookup />
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground glow-primary hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Hero & Selection Section */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 py-12 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary mb-2">
            <Sparkles className="w-3 h-3" />
            Welcome to MyScheduler
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Select Your <span className="gradient-text">Portal</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto">
            Choose how you would like to proceed with MyScheduler today
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Visitor Card */}
          <div className="glass-card border border-white/5 rounded-2xl p-8 space-y-6 flex flex-col justify-between hover:border-primary/20 hover:shadow-primary/5 hover:shadow-xl transition-all duration-300 group">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-primary animate-pulse-glow" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight">I am a Visitor</h3>
                <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Book Meetings & Track Requests</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Search for scheduling profiles, check availability in real time, and submit booking requests. 
                <span className="text-primary font-medium block mt-2">
                  🌍 Open to everyone! Non-acquaintances can also request bookings — the owner will be notified to approve.
                </span>
              </p>
            </div>
            <Link href="/visit" className="pt-4 block">
              <button className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:glow-primary font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer">
                Enter Visitor Portal
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {/* Owner Card */}
          <div className="glass-card border border-white/5 rounded-2xl p-8 space-y-6 flex flex-col justify-between hover:border-[var(--status-upcoming)]/20 hover:shadow-[var(--status-upcoming)]/5 hover:shadow-xl transition-all duration-300 group">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--status-upcoming)]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Settings className="w-7 h-7 text-[var(--status-upcoming)]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight">I am an Owner</h3>
                <p className="text-xs font-semibold text-[var(--status-upcoming)] uppercase tracking-wider">Manage Schedule & Bookings</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Manage your available slots, review pending requests with custom status badges, and reschedule bookings.
                <span className="text-[var(--status-upcoming)] font-medium block mt-2">
                  📧 Notifications: Rescheduling a meeting automatically notifies visitors with rearranging options.
                </span>
              </p>
            </div>
            <Link href="/dashboard" className="pt-4 block">
              <button className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-[var(--status-upcoming)] hover:text-white hover:border-[var(--status-upcoming)] hover:shadow-[var(--status-upcoming)]/20 hover:shadow-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer">
                Enter Owner Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-muted-foreground bg-card/10">
        Built with ❤️ using Next.js, Supabase & Gemini AI
      </footer>
      <ChatPanel context="visitor" />
    </div>
  );
}
