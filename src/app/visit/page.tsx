"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, User, ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function PublicSearchPortal() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/search-people?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.users || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to search profiles.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex flex-col justify-between">
      {/* Background blobs */}
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
        <Button variant="outline" className="border-white/10 hover:bg-white/5 text-xs" onClick={() => router.push("/login")}>
          Sign In
        </Button>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-grow flex items-center justify-center p-4 py-12">
        <Card className="w-full max-w-xl glass-card border-white/10 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary mb-4 mx-auto">
              <Sparkles className="w-3 h-3" />
              Public Scheduling Directory
            </div>
            <CardTitle className="text-2xl font-bold gradient-text">Find a Scheduler</CardTitle>
            <CardDescription className="mt-1">
              Search by name or email to visit a user's calendar and book an appointment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter name or email address..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="glow-primary flex-shrink-0">
                {loading ? "Searching..." : "Search"}
              </Button>
            </form>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground font-semibold">Search Results</p>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {results.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{profile.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {profile.occupation ? `${profile.occupation} • ${profile.email}` : profile.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1 glow-primary"
                        onClick={() => router.push(`/visit/${profile.id}`)}
                      >
                        Visit
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.length === 0 && query && !loading && (
              <div className="text-center py-6 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                <User className="w-8 h-8 mx-auto mb-2 opacity-20 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No profiles found for "{query}".</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-muted-foreground bg-card/10">
        Built with ❤️ using Next.js, Supabase & Gemini AI
      </footer>

      {/* Chatbot support */}
      <ChatPanel context="visitor" />
    </div>
  );
}
