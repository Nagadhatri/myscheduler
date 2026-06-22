"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { format, isBefore, startOfDay, addDays } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Sparkles,
  CalendarPlus,
  User,
  ShieldAlert,
  Search,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatPanel from "@/components/chatbot/ChatPanel";

export default function PublicVisitorPage() {
  const params = useParams();
  const userId = params.userId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  // Booking dialog
  const [bookingSlot, setBookingSlot] = useState<{ start_time: string; end_time: string } | null>(null);
  const [bookName, setBookName] = useState("");
  const [bookEmail, setBookEmail] = useState("");
  const [bookReason, setBookReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Lookup dialog
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [searchingBookings, setSearchingBookings] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupEmail) return;
    setSearchingBookings(true);
    try {
      const res = await fetch(`/api/my-bookings?email=${encodeURIComponent(lookupEmail)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLookupResults(data.bookings || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to search bookings.");
    } finally {
      setSearchingBookings(false);
    }
  };

  // Load target profile (publicly accessible)
  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (error) throw error;
        setProfile(data);
      } catch (err: any) {
        console.error("Error fetching public profile:", err);
        toast.error("Could not find this scheduler profile.");
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [userId]);

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const today = startOfDay(new Date());
  const isPastDate = isBefore(startOfDay(selectedDate), today);

  // Fetch available slots from public API
  useEffect(() => {
    if (isPastDate) {
      setAvailableSlots([]);
      return;
    }
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await fetch(`/api/available-slots?userId=${userId}&date=${formattedDate}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAvailableSlots(data.available_slots || []);
      } catch (err: any) {
        console.error("Error loading available slots:", err);
        toast.error("Error loading available slots.");
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [userId, formattedDate, isPastDate]);

  const datesWithAvailability = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 30; i++) dates.push(addDays(today, i));
    return dates;
  }, []);

  const formatTime = (t: string) => {
    const hour = parseInt(t.slice(0, 2));
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:00 ${ampm}`;
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const wordCount = bookReason.trim().split(/\s+/).length;
    if (!bookingSlot || !bookReason.trim()) {
      toast.error("Please provide a reason for the meeting.");
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: formattedDate,
          startTime: bookingSlot.start_time,
          endTime: bookingSlot.end_time,
          name: bookName,
          email: bookEmail,
          description: bookReason,
        }),
      });

      const data = await res.json();
      if (res.status !== 200) {
        throw new Error(data.error || "Booking failed.");
      }

      toast.success("🎉 Booking request sent!");
      setBookingSlot(null);
      setBookReason("");
      
      // Update slots list locally
      setAvailableSlots((prev) => prev.filter((s) => s.start_time !== bookingSlot.start_time));
    } catch (err: any) {
      toast.error(err.message || "An error occurred during booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-6">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          The scheduler profile you are trying to visit does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header Profile — clearly shows WHOSE schedule you are booking */}
      <div className="flex items-center gap-4 mb-8 bg-card/40 border border-white/5 rounded-2xl p-6 glass-card">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <User className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">You are booking a meeting with</p>
          <h2 className="text-2xl font-bold tracking-tight text-primary">{profile.display_name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profile.occupation ? `${profile.occupation} • ${profile.email}` : profile.email}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 ml-auto">
          <Badge className="bg-[var(--status-upcoming)]/10 text-[var(--status-upcoming)] border-[var(--status-upcoming)]/20 text-xs">
            Public Scheduler
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Calendar & Track Bookings */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="glass-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5 text-primary" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { if (date) setSelectedDate(date); }}
                className="rounded-xl"
                modifiers={{ available: datesWithAvailability }}
                modifiersClassNames={{ available: "font-semibold text-primary" }}
                disabled={(date) => isBefore(startOfDay(date), today)}
              />
            </CardContent>
          </Card>

          {/* Track Bookings Panel */}
          <Card className="glass-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="w-5 h-5 text-primary" />
                Track My Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLookup} className="flex gap-2 mb-4">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs"
                />
                <Button type="submit" disabled={searchingBookings} className="glow-primary flex-shrink-0 text-xs h-9">
                  {searchingBookings ? "..." : "Search"}
                </Button>
              </form>

              {lookupResults.length > 0 && (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {lookupResults.map((b) => (
                    <div key={b.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-xs truncate mr-2">
                          {b.schedule?.owner?.display_name || "Host"}
                        </p>
                        <Badge className={`text-[10px] ${
                          b.booking_status === "Accepted" || b.booking_status === "Accepted with Remarks"
                            ? "bg-[var(--status-completed)]/10 text-[var(--status-completed)] border-[var(--status-completed)]/20"
                            : b.booking_status === "Rejected"
                              ? "bg-[var(--status-cancelled)]/10 text-[var(--status-cancelled)] border-[var(--status-cancelled)]/20"
                              : b.booking_status === "Rescheduled"
                                ? "bg-[var(--status-rescheduled)]/10 text-[var(--status-rescheduled)] border-[var(--status-rescheduled)]/20"
                                : "bg-primary/10 text-primary border-primary/20"
                        }`}>
                          {b.booking_status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {b.schedule?.date} | {formatTime(b.schedule?.start_time)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Available Slots */}
        <div className="lg:col-span-5">
          <Card className="glass-card border-white/5 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[var(--status-completed)]" />
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </span>
                {loadingSlots && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto pr-2">
              {isPastDate ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>This date has already passed.</p>
                </div>
              ) : availableSlots.length === 0 && !loadingSlots ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No available slots for this date.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {availableSlots.map((slot) => (
                    <div
                      key={slot.start_time}
                      className="slot-card p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                          </p>
                          <p className="text-xs text-muted-foreground">Available</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="glow-primary text-xs px-3"
                        onClick={() => setBookingSlot({ start_time: slot.start_time, end_time: slot.end_time })}
                      >
                        <CalendarPlus className="w-3.5 h-3.5 mr-1" />
                        Book
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Chatbot */}
        <div className="lg:col-span-4">
          <div className="h-[600px]">
            <ChatPanel context="visitor" targetUserId={userId} mode="inline" />
          </div>
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!bookingSlot} onOpenChange={(open) => !open && setBookingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Slot with {profile.display_name}</DialogTitle>
            <DialogDescription>
              {bookingSlot && `${formatTime(bookingSlot.start_time)} – ${formatTime(bookingSlot.end_time)} on ${formattedDate}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBook} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Your Full Name</Label>
              <Input required value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Your Email Address</Label>
              <Input required type="email" value={bookEmail} onChange={(e) => setBookEmail(e.target.value)} placeholder="john@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Reason for Meeting</Label>
              <Input required value={bookReason} onChange={(e) => setBookReason(e.target.value)} placeholder="Let's meet to discuss the project..." />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting} className="w-full glow-primary">
                {submitting ? "Submitting..." : "Submit Booking Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
