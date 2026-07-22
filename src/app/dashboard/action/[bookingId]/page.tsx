"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, CalendarDays, Loader2 } from "lucide-react";

export default function BookingActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [actionQuery, setActionQuery] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState<"Accepted" | "Rejected" | "Accepted with Remarks" | "Rejected">("Accepted");

  const supabase = createClient();

  // Unwrap params
  useEffect(() => {
    async function loadParams() {
      const p = await params;
      const s = await searchParams;
      setBookingId(p.bookingId);
      setActionQuery(s.action || null);
    }
    loadParams();
  }, [params, searchParams]);

  // Load booking details
  useEffect(() => {
    if (!bookingId) return;

    const fetchBooking = async () => {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/login?redirect=${currentUrl}`);
        return;
      }

      const { data, error } = await supabase
        .from("bookings")
        .select("*, schedule:schedules(*)")
        .eq("id", bookingId)
        .single();

      if (error || !data) {
        toast.error("Booking not found");
      } else {
        setBooking(data);
      }
      setLoading(false);
    };

    fetchBooking();
  }, [bookingId, supabase]);

  // Map the action string from query
  useEffect(() => {
    if (!actionQuery) return;
    
    switch (actionQuery) {
      case "Accepted":
        setStatus("Accepted");
        break;
      case "AcceptedWithRemarks":
        setStatus("Accepted with Remarks");
        break;
      case "Rejected":
        setStatus("Rejected");
        break;
      case "RejectedWithRemarks":
        setStatus("Rejected");
        break;
      default:
        setStatus("Accepted");
    }
  }, [actionQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;

    setSubmitting(true);
    
    // Automatically upgrade status if remarks are provided
    let finalStatus = status;
    if (remarks.trim() !== "") {
      if (status === "Accepted") finalStatus = "Accepted with Remarks";
    }

    try {
      const res = await fetch("/api/booking-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          status: finalStatus,
          remarks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(data.message);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to process booking action.");
      setSubmitting(false);
    }
  };

  if (loading || !bookingId) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <X className="w-16 h-16 text-red-500 mb-4 opacity-50" />
        <h2 className="text-xl font-bold">Booking Not Found</h2>
        <Button onClick={() => router.push("/dashboard")} className="mt-4">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const isAccepting = status.includes("Accepted");

  return (
    <div className="p-6 max-w-2xl mx-auto pt-16">
      <Card className="glass-card border-white/10 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-4 mx-auto ${isAccepting ? 'bg-[var(--status-completed)]/10 border-[var(--status-completed)]/20 text-[var(--status-completed)]' : 'bg-[var(--status-cancelled)]/10 border-[var(--status-cancelled)]/20 text-[var(--status-cancelled)]'}`}>
            {isAccepting ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            <span className="font-semibold">
              {isAccepting ? "Accept Booking Request" : "Reject Booking Request"}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">
            Respond to {booking.visitor_name}
          </CardTitle>
          <CardDescription>
            You are about to {isAccepting ? "accept" : "reject"} this booking. The visitor will be notified via email.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Booking Summary */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-muted-foreground text-sm">Visitor Email</span>
              <span className="font-medium text-sm">{booking.visitor_email}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-muted-foreground text-sm">Date & Time</span>
              <span className="font-medium text-sm flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" />
                {booking.schedule.date} ({booking.schedule.start_time.slice(0, 5)})
              </span>
            </div>
            <div className="pt-2">
              <span className="text-muted-foreground text-sm block mb-1">Reason for meeting</span>
              <p className="text-sm italic">"{booking.description}"</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remarks">
                Remarks to visitor (Optional)
              </Label>
              <Input
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={isAccepting ? "E.g., Please bring your laptop." : "E.g., I'm busy that day, please pick another slot."}
                className="bg-background"
                autoComplete="off"
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={submitting} 
              className={`w-full h-11 ${isAccepting ? 'bg-[var(--status-completed)] hover:bg-[var(--status-completed)]/90 glow-[var(--status-completed)] text-white' : 'bg-[var(--status-cancelled)] hover:bg-[var(--status-cancelled)]/90 glow-[var(--status-cancelled)] text-white'}`}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <>{isAccepting ? "Confirm Accept" : "Confirm Reject"}</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
