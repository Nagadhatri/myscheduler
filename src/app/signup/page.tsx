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
import { UserPlus, Mail, Lock, User, Eye, EyeOff, CheckCircle, ArrowRight, MailOpen } from "lucide-react";
import Link from "next/link";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [occupation, setOccupation] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name, occupation },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      // Sync profile via server to bypass RLS issues
      if (data.user) {
        try {
          await fetch("/api/sync-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.user.id,
              email: email,
              display_name: name,
              occupation: occupation,
            }),
          });
        } catch (e) {
          console.error("Failed to sync profile", e);
        }
      }

      if (data.session) {
        toast.success("Account created! Welcome aboard 🎉");
        window.location.href = "/dashboard";
      } else {
        setShowConfirmation(true);
      }
    }
  };

  if (showConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[var(--status-completed)]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <Card className="w-full max-w-md glass-card border-white/10 relative z-10">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 rounded-2xl bg-[var(--status-completed)]/10 border border-[var(--status-completed)]/20 flex items-center justify-center mx-auto mb-4">
              <MailOpen className="w-8 h-8 text-[var(--status-completed)]" />
            </div>
            <CardTitle className="text-2xl font-bold gradient-text">
              Check Your Email! 📧
            </CardTitle>
            <CardDescription className="mt-3 text-sm leading-relaxed">
              Your account has been created successfully!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-[var(--status-completed)] flex-shrink-0" />
                <p className="text-sm">We sent a confirmation link to <strong className="text-primary">{email}</strong></p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm">Open the email and <strong>click the confirmation link</strong> to activate your account</p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm">Then come back here and <strong>Sign In</strong> with your credentials</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Can't find the email? Check your <strong>spam/junk folder</strong>. The email is from Supabase.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Link href="/login" className="w-full">
              <Button className="w-full glow-primary">
                <Mail className="w-4 h-4 mr-2" />
                Go to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[var(--status-completed)]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass-card border-white/10 relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-[var(--status-completed)]/10 border border-[var(--status-completed)]/20 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-7 h-7 text-[var(--status-completed)]" />
          </div>
          <CardTitle className="text-2xl font-bold gradient-text">
            Create Account
          </CardTitle>
          <CardDescription className="mt-1">
            Join MyScheduler and start managing your time
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Display Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-10 bg-white/5 border-white/10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
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
            <div className="space-y-2">
              <Label htmlFor="occupation" className="text-sm">Occupation</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="occupation"
                  placeholder="e.g. Software Engineer, Designer"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  required
                  className="pl-10 bg-white/5 border-white/10"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full glow-primary" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      <ChatPanel context="visitor" />
    </div>
  );
}
