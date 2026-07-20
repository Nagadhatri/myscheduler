import Link from "next/link";
import { CalendarDays, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import ChatPanel from "@/components/chatbot/ChatPanel";

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
          <div className="text-lg font-bold tracking-tight gradient-text">MyScheduler</div>
        </div>
      </header>

      {/* Main Content Section */}
      <main id="main-content" className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 py-12 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-center">
          
          {/* Left Side: Information */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
              <Sparkles className="w-3 h-3" />
              Your Intelligent Scheduling Assistant
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              What is <span className="gradient-text">MyScheduler?</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              MyScheduler is an advanced scheduling platform that effortlessly aligns your calendar with your professional network. Built for modern teams and independent professionals.
            </p>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold tracking-tight text-foreground/90">Why it's great:</h3>
              <ul className="space-y-3">
                {[
                  "AI-Powered Chatbot to manage your bookings instantly",
                  "Automated smart summaries & AI generated meeting reports",
                  "Seamlessly connect and share your availability with others",
                  "Real-time notifications and conflict resolution"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Side: Empty or simple graphic (removed optional button as per feedback) */}
          <div className="hidden lg:flex justify-center relative">
            <div className="w-full aspect-square max-w-md relative glass-card border border-white/5 rounded-3xl p-8 flex items-center justify-center bg-card/20 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-[var(--status-upcoming)]/10 rounded-3xl opacity-50 pointer-events-none" />
              <div className="text-center space-y-4 relative z-10">
                <CalendarDays className="w-24 h-24 text-primary/80 mx-auto" strokeWidth={1} />
                <p className="text-2xl font-light text-foreground/70 tracking-widest uppercase">Take Control</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Sign In and Get Started */}
        <div className="w-full mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-semibold text-sm transition-all duration-300 text-center">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-primary text-primary-foreground glow-primary hover:opacity-90 font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-muted-foreground bg-card/10">
        Built with ❤️ using <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Next.js</a>, <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Supabase</a> & <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Gemini AI</a><br/>
        <span className="text-xs opacity-70 mt-2 block">© 2026 MyScheduler. All rights reserved.</span>
      </footer>
      
      {/* We keep the ChatPanel but it should be noted it's now context="visitor" without a specific owner. 
          The chatbot can answer general queries about the app. */}
      <ChatPanel context="visitor" />
    </div>
  );
}
