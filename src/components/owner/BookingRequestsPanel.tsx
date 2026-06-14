"use client";

import { useState } from "react";
import { useDashboard } from "./DashboardContext";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Booking, BookingStatusType, Schedule } from "@/types";

export default function BookingRequestsPanel() {
  const { bookings, fetchBookings } = useDashboard();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionDialog, setActionDialog] = useState<"AcceptWithRemarks" | "Reject" | "Reschedule" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();

  const handleAction = async (bookingId: string, status: BookingStatusType, notes: string = "") => {
    setLoading(true);
    
    // In a real app, this would also hit our API route to trigger the email webhook.
    // For simplicity, we update DB first, then we could optionally trigger email.
    const { error } = await supabase.from('bookings').update({
      booking_status: status,
      owner_remarks: notes,
      action_timestamp: new Date().toISOString()
    }).eq('id', bookingId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Booking ${status.toLowerCase()}`);
      
      // We should ideally call our backend to send the email here.
      // fetch('/api/email', { method: 'POST', body: JSON.stringify({ bookingId, status }) })
      
      setActionDialog(null);
      setRemarks("");
      fetchBookings();
    }
    setLoading(false);
  };

  const pendingBookings = bookings.filter(b => b.booking_status === 'Pending');

  return (
    <Card className="flex-1 flex flex-col max-h-[300px]">
      <CardHeader className="py-3">
        <CardTitle className="text-lg">Pending Requests ({pendingBookings.length})</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 py-2">
          {pendingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pending requests.</p>
          ) : (
            <div className="space-y-3">
              {pendingBookings.map((b) => {
                const s = (b as any).schedule as Schedule;
                return (
                  <div key={b.id} className="p-3 border rounded-md bg-muted/30 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{b.visitor_name}</p>
                        <p className="text-xs text-muted-foreground">{b.visitor_email}</p>
                      </div>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold">{s?.title}</span> - {s?.date} ({s?.start_time.slice(0,5)} - {s?.end_time.slice(0,5)})
                    </div>
                    {b.description && <p className="text-xs italic">"{b.description}"</p>}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Button size="sm" variant="default" onClick={() => handleAction(b.id, 'Accepted')}>Accept</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setSelectedBooking(b); setActionDialog("AcceptWithRemarks"); }}>Accept w/ Remarks</Button>
                      <Button size="sm" variant="destructive" onClick={() => { setSelectedBooking(b); setActionDialog("Reject"); }}>Reject</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'AcceptWithRemarks' && 'Accept with Remarks'}
              {actionDialog === 'Reject' && 'Reject Request'}
              {actionDialog === 'Reschedule' && 'Reschedule Booking'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Remarks / Message to Visitor</Label>
              <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="E.g., Please bring your ID." />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={loading} onClick={() => {
              if (selectedBooking && actionDialog) {
                const statusMap: Record<string, BookingStatusType> = {
                  'AcceptWithRemarks': 'Accepted with Remarks',
                  'Reject': 'Rejected',
                  'Reschedule': 'Rescheduled'
                };
                handleAction(selectedBooking.id, statusMap[actionDialog], remarks);
              }
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
