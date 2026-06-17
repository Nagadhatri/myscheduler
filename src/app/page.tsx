import Link from "next/link";
import { CalendarDays, Users, Clock, Sparkles, ArrowRight, Shield } from "lucide-react";

export default function LandingPage() {
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
          <h1 className="text-lg font-bold tracking-tight gradient-text">MyScheduler</h1>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Hero */}
      <section className="relative z-10 text-center py-24 px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary mb-6">
          <Sparkles className="w-3 h-3" />
          Social Scheduling Platform
        </div>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 max-w-3xl mx-auto leading-tight">
          Schedule smarter,
          <span className="gradient-text"> together</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-10">
          Create your own scheduler. Connect with people. View and book appointments — all in one premium platform.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium glow-primary hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            Create Your Scheduler
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl border border-white/10 text-foreground font-medium hover:bg-white/5 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: CalendarDays,
              title: "Your Own Scheduler",
              desc: "Create and manage your schedule with hourly slots from 5 AM to 11 PM. Add meetings, presentations, events, and more.",
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              icon: Users,
              title: "Connect with People",
              desc: "Search for friends and colleagues. Send connection requests. Once connected, view and book on each other's calendars.",
              color: "text-[var(--status-completed)]",
              bg: "bg-[var(--status-completed)]/10",
            },
            {
              icon: Shield,
              title: "Privacy First",
              desc: "Your schedule is private by default. Only people you've accepted as connections can see your availability and book with you.",
              color: "text-[var(--status-upcoming)]",
              bg: "bg-[var(--status-upcoming)]/10",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="glass-card border border-white/5 rounded-2xl p-6 space-y-4 slot-card"
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-muted-foreground">
        Built with ❤️ using Next.js, Supabase & Gemini AI
      </footer>
    </div>
  );
}
