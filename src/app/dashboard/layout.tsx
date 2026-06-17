"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, Users, CalendarDays } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "My Schedule", icon: CalendarDays },
    { href: "/people", label: "People", icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-[var(--status-upcoming)]/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/5 bg-card/50 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight gradient-text">
              MyScheduler
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-2 text-xs ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="gap-2 border-white/10 hover:bg-white/5"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </header>

      <main className="relative z-10 flex-1">{children}</main>
    </div>
  );
}
