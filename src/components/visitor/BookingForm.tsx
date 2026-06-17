"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

interface BookingFormProps {
  date: string;
  startTime: string;
  endTime: string;
}

export default function BookingForm({ date, startTime, endTime }: BookingFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const formatTime = (t: string) => {
    const hour = parseInt(t.slice(0, 2));
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:00 ${ampm}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 10) {
      toast.error("Please provide at least 10 characters for your reason.");
      return;
    }

    setLoading(true);

    // First, create a schedule record for this slot (since we auto-generate slots)
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("schedules")
      .insert({
        title: `Booking by ${name}`,
        category: "Meeting",
        date,
        start_time: startTime,
        end_time: endTime,
        status: "Upcoming",
      })
      .select("id")
      .single();

    if (scheduleError) {
      toast.error("Failed to create slot: " + scheduleError.message);
      setLoading(false);
      return;
    }

    // Then create the booking linked to that schedule
    const { error: bookingError } = await supabase.from("bookings").insert({
      schedule_id: scheduleData.id,
      visitor_name: name,
      visitor_email: email,
      description: reason,
      booking_status: "Pending",
    });

    setLoading(false);

    if (bookingError) {
      toast.error("Failed to submit request: " + bookingError.message);
    } else {
      toast.success("🎉 Booking request submitted! You'll be notified once approved.");
      setOpen(false);
      setName("");
      setEmail("");
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="glow-primary text-xs px-3">
            <CalendarPlus className="w-3.5 h-3.5 mr-1" />
            Book
          </Button>
        }
      >
        Book
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Appointment</DialogTitle>
          <DialogDescription>
            {formatTime(startTime)} – {formatTime(endTime)} on {date}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Your Name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Reason for Meeting (min 10 characters)</Label>
            <Input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="I would like to discuss..."
            />
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading} className="w-full glow-primary">
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
