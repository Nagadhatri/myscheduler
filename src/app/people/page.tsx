"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile, Connection } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Link from "next/link";
import {
  Search,
  UserPlus,
  Users,
  Check,
  X,
  Clock,
  CalendarDays,
  Inbox,
  ArrowRight,
} from "lucide-react";

export default function PeoplePage() {
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        fetchConnections(user.id);
      }
    };
    init();
  }, []);

  const fetchConnections = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("connections")
      .select("*, requester:profiles!requester_id(*), receiver:profiles!receiver_id(*)")
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (data) setConnections(data as Connection[]);
    setLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentUserId) return;
    setSearching(true);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .neq("id", currentUserId)
      .limit(10);

    setSearchResults(data || []);
    setSearching(false);
  };

  const sendRequest = async (receiverId: string) => {
    const { error } = await supabase.from("connections").insert({
      requester_id: currentUserId,
      receiver_id: receiverId,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") toast.error("Connection request already sent!");
      else toast.error(error.message);
    } else {
      toast.success("Connection request sent! 🤝");
      if (currentUserId) fetchConnections(currentUserId);
    }
  };

  const handleConnectionAction = async (connectionId: string, action: "accepted" | "rejected") => {
    const { error } = await supabase
      .from("connections")
      .update({ status: action })
      .eq("id", connectionId);

    if (error) toast.error(error.message);
    else {
      toast.success(action === "accepted" ? "Connection accepted! 🎉" : "Connection declined.");
      if (currentUserId) fetchConnections(currentUserId);
    }
  };

  const removeConnection = async (connectionId: string) => {
    if (!confirm("Remove this connection?")) return;
    const { error } = await supabase.from("connections").delete().eq("id", connectionId);
    if (!error && currentUserId) {
      toast.success("Connection removed.");
      fetchConnections(currentUserId);
    }
  };

  const getConnectionStatus = (profileId: string) => {
    return connections.find(
      (c) =>
        (c.requester_id === profileId || c.receiver_id === profileId) &&
        (c.requester_id === currentUserId || c.receiver_id === currentUserId)
    );
  };

  const pendingIncoming = connections.filter(
    (c) => c.status === "pending" && c.receiver_id === currentUserId
  );
  const pendingOutgoing = connections.filter(
    (c) => c.status === "pending" && c.requester_id === currentUserId
  );
  const accepted = connections.filter((c) => c.status === "accepted");

  const getOtherProfile = (conn: Connection) => {
    if (conn.requester_id === currentUserId) return conn.receiver;
    return conn.requester;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Search */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4 text-primary" />
            Find People
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border-white/10"
            />
            <Button type="submit" disabled={searching} className="glow-primary">
              {searching ? "..." : "Search"}
            </Button>
          </form>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((profile) => {
                const existing = getConnectionStatus(profile.id);
                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]"
                  >
                    <div>
                      <p className="font-medium text-sm">{profile.display_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                    {existing ? (
                      <Badge className="bg-white/5 border border-white/10 text-xs">
                        {existing.status === "accepted" ? "Connected" : "Pending"}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 glow-primary"
                        onClick={() => sendRequest(profile.id)}
                      >
                        <UserPlus className="w-3 h-3" />
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Incoming Requests */}
        <Card className="glass-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[var(--status-rescheduled)]" />
                Incoming Requests
              </span>
              {pendingIncoming.length > 0 && (
                <Badge className="bg-[var(--status-rescheduled)]/15 text-[var(--status-rescheduled)] border border-[var(--status-rescheduled)]/20 text-xs">
                  {pendingIncoming.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[250px]">
              {pendingIncoming.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {pendingIncoming.map((conn) => {
                    const profile = conn.requester;
                    return (
                      <div key={conn.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div>
                          <p className="font-medium text-sm">{profile?.display_name}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-xs gap-1 glow-primary" onClick={() => handleConnectionAction(conn.id, "accepted")}>
                            <Check className="w-3 h-3" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-white/10" onClick={() => handleConnectionAction(conn.id, "rejected")}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Outgoing Requests */}
        <Card className="glass-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-[var(--status-upcoming)]" />
              Sent Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[250px]">
              {pendingOutgoing.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {pendingOutgoing.map((conn) => {
                    const profile = conn.receiver;
                    return (
                      <div key={conn.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div>
                          <p className="font-medium text-sm">{profile?.display_name}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                        <Badge className="bg-[var(--status-upcoming)]/15 text-[var(--status-upcoming)] border border-[var(--status-upcoming)]/20 text-xs">
                          Pending
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* My Connections */}
      <Card className="glass-card border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-[var(--status-completed)]" />
            My Connections ({accepted.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accepted.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No connections yet.</p>
              <p className="text-xs mt-1">Search for people above to connect!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accepted.map((conn) => {
                const profile = getOtherProfile(conn);
                return (
                  <div key={conn.id} className="slot-card p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
                    <div>
                      <p className="font-semibold text-sm">{profile?.display_name}</p>
                      <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/schedule/${profile?.id}`} className="flex-1">
                        <Button size="sm" className="w-full h-7 text-xs gap-1 glow-primary">
                          <CalendarDays className="w-3 h-3" />
                          View Schedule
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-white/10 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => removeConnection(conn.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
