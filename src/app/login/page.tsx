"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Lock, Mail, LayoutDashboard, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");

  import("react").then((React) => {
    if (!csrfToken) setCsrfToken(crypto.randomUUID());
  });
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [emailResent, setEmailResent] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const resendVerification = async () => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Verification email resent! Check your inbox.");
        setEmailResent(true);
      }
    } catch (e) {
      toast.error("Failed to resend verification email.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setLoading(false);

    if (error) {
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes("invalid login credentials")) {
        toast.error("Invalid login credentials. If you just signed up, please verify your email.");
      } else if (errMsg.includes("email not confirmed") || errMsg.includes("email not verified")) {
        setLoginError("email_not_verified");
        toast.error("Your email is not verified. Please check your inbox.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Welcome back!");
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect') || '/dashboard';
      window.location.href = redirectUrl;
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
            <LayoutDashboard className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold gradient-text">Sign In</CardTitle>
          <CardDescription className="mt-1">
            Sign in to manage your schedule
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-white/5 border-white/10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 bg-white/5 border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full glow-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : "Sign In"}
            </Button>
            {loginError === "email_not_verified" && !emailResent && (
              <Button type="button" variant="outline" className="w-full" onClick={resendVerification}>
                Resend verification email
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
            </p>
          </CardFooter>
        </form>
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
