"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Booking, Schedule } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Clock, Mail, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function PastBookingLookup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(Booking & { schedule: Schedule })[]>(
    []
  );
  const [searched, setSearched] = useState(false);

  const supabase = createClient();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("*, schedule:schedules(*)")
      .eq("visitor_email", email)
      .order("created_at", { ascending: false });

    setLoading(false);
    setSearched(true);

    if (error) {
      toast.error("Error looking up bookings");
    } else {
      setResults(data as any);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Accepted":
      case "Accepted with Remarks":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Rejected":
      case "Cancelled":
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Accepted":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
      case "Accepted with Remarks":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
      case "Rejected":
        return "bg-red-500/15 text-red-400 border-red-500/20";
      case "Cancelled":
        return "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
      case "Rescheduled":
        return "bg-orange-500/15 text-orange-400 border-orange-500/20";
      default:
        return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    }
  };

  const formatTime = (t: string) => {
    if (!t) return "";
    const hour = parseInt(t.slice(0, 2));
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:00 ${ampm}`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setEmail("");
          setResults([]);
          setSearched(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5 text-xs h-9">
          <Search className="w-4 h-4" />
          Track My Bookings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Find Your Bookings
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex gap-2 my-2">
          <Input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Search"}
          </Button>
        </form>

        {searched && (
          <ScrollArea className="h-[320px] mt-2">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No bookings found for this email.</p>
              </div>
            ) : (
              <div className="space-y-3 pr-3">
                {results.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-medium">{b.schedule?.title || "Appointment"}</div>
                      <Badge
                        className={`${getStatusColor(b.booking_status)} border text-xs gap-1`}
                      >
                        {getStatusIcon(b.booking_status)}
                        {b.booking_status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {b.schedule?.date} · {formatTime(b.schedule?.start_time)} –{" "}
                      {formatTime(b.schedule?.end_time)}
                    </div>
                    {b.owner_remarks && (
                      <div className="bg-primary/5 border border-primary/10 p-2.5 rounded-lg text-sm mt-2">
                        <span className="font-semibold text-primary">Remark:</span>{" "}
                        {b.owner_remarks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
