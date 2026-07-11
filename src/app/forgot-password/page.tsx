"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, KeyRound, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const supabase = createClient();

  import("react").then((React) => {
    if (!csrfToken) setCsrfToken(crypto.randomUUID());
  });

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const resetRedirect = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirect,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Reset link sent successfully!");
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[var(--status-upcoming)]/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass-card border-white/10 relative z-10">
        <div className="absolute top-4 left-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        <CardHeader className="text-center pb-2 pt-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold gradient-text">Reset Password</CardTitle>
          <CardDescription className="mt-1">
            Confirm your email to reset your password
          </CardDescription>
        </CardHeader>
        {submitted ? (
          <CardContent className="space-y-4 text-center py-6">
            <p className="text-sm leading-relaxed">
              We&apos;ve sent a password recovery link to <strong className="text-primary">{email}</strong>.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please check your inbox (and spam folder) and click the link to reset your password.
            </p>
            <div className="pt-4">
              <Link href="/login">
                <Button variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleReset}>
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-white/5 border-white/10"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full glow-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending link...
                  </>
                ) : "Send Reset Link"}
              </Button>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>

      {/* Standard Footer */}
      <footer className="absolute bottom-0 w-full z-10 border-t border-white/5 py-8 text-center text-sm text-muted-foreground bg-card/10">
        Built with ❤️ using <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Next.js</a>, <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Supabase</a> & <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Gemini AI</a><br/>
        <span className="text-xs opacity-70 mt-2 block">© 2026 MyScheduler. All rights reserved.</span>
      </footer>

      <ChatPanel context="visitor" />
    </div>
  );
}
