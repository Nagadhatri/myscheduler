"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const isLogin = pathname === "/owner/login";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/owner/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!isLogin && (
        <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">MyScheduler Owner Dashboard</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </header>
      )}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
