"use client";

import { useState } from "react";
import { Schedule } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

export default function BookingForm({ schedule }: { schedule: Schedule }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.length < 10) {
      toast.error("Description must be at least 10 characters long.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('bookings').insert({
      schedule_id: schedule.id,
      visitor_name: name,
      visitor_email: email,
      description,
      booking_status: 'Pending'
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to submit request: " + error.message);
    } else {
      toast.success("Booking request submitted! We will notify you once approved.");
      
      // Ideally trigger email webhook to owner here
      // fetch('/api/email', ...)
      
      setOpen(false);
      setName("");
      setEmail("");
      setDescription("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Book Slot</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Appointment</DialogTitle>
          <DialogDescription>
            {schedule.title} on {format(new Date(schedule.date), "MMM d, yyyy")} from {schedule.start_time.slice(0,5)} to {schedule.end_time.slice(0,5)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input required value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Reason / Description (min 10 chars)</Label>
            <Input required value={description} onChange={e => setDescription(e.target.value)} placeholder="I would like to discuss..." />
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
