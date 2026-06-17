"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Users, Briefcase, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function ProfileAndConnectionsPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connections, setConnections] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadProfileAndConnections = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch own profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profileData) setProfile(profileData);

        // 2. Fetch connections
        const { data: connectionsData } = await supabase
          .from("connections")
          .select(`
            id,
            status,
            requester:profiles!connections_requester_id_fkey(*),
            receiver:profiles!connections_receiver_id_fkey(*)
          `)
          .eq("status", "accepted");

        if (connectionsData) {
          const connectedProfiles = connectionsData.map((conn: any) => {
            return conn.requester.id === user.id ? conn.receiver : conn.requester;
          });
          setConnections(connectedProfiles);
        }
      } catch (err) {
        console.error("Error loading profile or connections:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileAndConnections();
  }, []);

  if (loading) {
    return (
      <Card className="glass-card border-white/5">
        <CardContent className="py-6 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Profile */}
      <Card className="glass-card border-white/5 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-[var(--status-upcoming)]" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-primary" />
            My Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{profile?.display_name || "Owner"}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-white/5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{profile?.occupation || "Professional"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connections Sideboard */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-[var(--status-completed)]" />
            Connections ({connections.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {connections.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground space-y-2">
              <Users className="w-8 h-8 mx-auto opacity-20" />
              <p>No connections yet.</p>
              <Link href="/people">
                <Button size="sm" variant="link" className="text-xs text-primary p-0 h-auto">
                  Find people to connect
                </Button>
              </Link>
            </div>
          ) : (
            connections.map((conn) => (
              <div
                key={conn.id}
                className="p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate">{conn.display_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{conn.occupation || "Professional"}</p>
                </div>
                <Link href={`/schedule/${conn.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 px-2 hover:bg-white/5 text-[10px] flex items-center gap-1 flex-shrink-0">
                    View
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
