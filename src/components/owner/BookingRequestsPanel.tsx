"use client";

import { useState } from "react";
import { useDashboard } from "./DashboardContext";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Booking, BookingStatusType, Schedule } from "@/types";
import { Inbox, Check, MessageSquare, X, Clock, AlertTriangle, UserPlus } from "lucide-react";

export default function BookingRequestsPanel() {
  const { bookings, fetchBookings } = useDashboard();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionDialog, setActionDialog] = useState<
    "AcceptWithRemarks" | "Reject" | "Reschedule" | null
  >(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleAction = async (
    bookingId: string,
    status: BookingStatusType,
    notes: string = ""
  ) => {
    setLoading(true);

    try {
      const res = await fetch("/api/booking-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          status,
          remarks: notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(`Booking ${status.toLowerCase()}`);
      setActionDialog(null);
      setRemarks("");
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message);
    }

    setLoading(false);
  };

  // Handle approving a non-acquaintance — moves from "Pending Approval" to "Pending"
  const handleApproveStranger = async (bookingId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        booking_status: "Pending",
        owner_remarks: "Non-acquaintance approved by owner",
        action_timestamp: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Visitor approved! Booking is now pending your final acceptance.");
      fetchBookings();
    }
    setLoading(false);
  };

  const pendingBookings = bookings.filter(
    (b) => b.booking_status === "Pending"
  );
  const totalPending = pendingBookings.length;

  return (
    <Card className="glass-card border-white/5">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-[var(--status-rescheduled)]" />
            Pending Requests
          </span>
          {totalPending > 0 && (
            <Badge className="bg-[var(--status-rescheduled)]/15 text-[var(--status-rescheduled)] border border-[var(--status-rescheduled)]/20 text-xs">
              {totalPending}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px] px-6 py-2">
          {totalPending === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* PENDING BOOKING REQUESTS */}
              {pendingBookings.map((b) => {
                const s = (b as any).schedule as Schedule;
                return (
                  <div
                    key={b.id}
                    className="slot-card p-3 rounded-xl border border-white/5 bg-white/[0.02] space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{b.visitor_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.visitor_email}
                        </p>
                      </div>
                      <Badge className="bg-[var(--status-upcoming)]/15 text-[var(--status-upcoming)] border border-[var(--status-upcoming)]/20 text-xs">
                        Pending
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {s?.title} · {s?.date} ({s?.start_time?.slice(0, 5)} –{" "}
                      {s?.end_time?.slice(0, 5)})
                    </div>
                    {b.description && (
                      <p className="text-xs italic text-muted-foreground">
                        &quot;{b.description}&quot;
                      </p>
                    )}
                    <div className="flex gap-2 mt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 glow-primary"
                        onClick={() => handleAction(b.id, "Accepted")}
                      >
                        <Check className="w-3 h-3" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setSelectedBooking(b);
                          setActionDialog("AcceptWithRemarks");
                        }}
                      >
                        <MessageSquare className="w-3 h-3" />
                        Remarks
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setSelectedBooking(b);
                          setActionDialog("Reject");
                        }}
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <Dialog
        open={!!actionDialog}
        onOpenChange={(open) => !open && setActionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "AcceptWithRemarks" && "Accept with Remarks"}
              {actionDialog === "Reject" && "Reject Request"}
              {actionDialog === "Reschedule" && "Reschedule Booking"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message to Visitor</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="E.g., Please bring your ID."
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={loading}
              className="glow-primary"
              onClick={() => {
                if (selectedBooking && actionDialog) {
                  const statusMap: Record<string, BookingStatusType> = {
                    AcceptWithRemarks: "Accepted with Remarks",
                    Reject: "Rejected",
                    Reschedule: "Rescheduled",
                  };
                  handleAction(
                    selectedBooking.id,
                    statusMap[actionDialog],
                    remarks
                  );
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
