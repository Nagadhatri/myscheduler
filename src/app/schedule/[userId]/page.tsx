"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile, Schedule } from "@/types";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  ArrowLeft,
  ShieldAlert,
  CalendarPlus,
  User,
  Search,
} from "lucide-react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddToCalendar } from "@/components/ui/add-to-calendar";
function generateDaySlots(dateStr: string, durationMins: number = 60, bufferMins: number = 0, ownerTimezone: string = 'Asia/Kolkata') {
  const slots = [];
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ownerTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  let yyyy, mm, dd, hh, min;
  for (const part of parts) {
    if (part.type === 'year') yyyy = part.value;
    if (part.type === 'month') mm = part.value;
    if (part.type === 'day') dd = part.value;
    if (part.type === 'hour') hh = part.value;
    if (part.type === 'minute') min = part.value;
  }
  const todayDate = `${yyyy}-${mm}-${dd}`;
  const currentHour = hh === '24' ? 0 : parseInt(hh || '0', 10);
  const currentMin = parseInt(min || '0', 10);
  const isToday = dateStr === todayDate;

  let startMins = 9 * 60; // 9 AM
  const endMins = 17 * 60; // 5 PM

  while (startMins + durationMins <= endMins) {
    const h = Math.floor(startMins / 60);
    const m = startMins % 60;
    
    if (isToday && (h < currentHour || (h === currentHour && m <= currentMin))) {
        startMins += durationMins + bufferMins;
        continue;
    }
    
    const startH = String(h).padStart(2, '0');
    const startM = String(m).padStart(2, '0');
    
    const endH = String(Math.floor((startMins + durationMins) / 60)).padStart(2, '0');
    const endM = String((startMins + durationMins) % 60).padStart(2, '0');

    slots.push({
      id: `${dateStr}-${startH}:${startM}`,
      date: dateStr,
      start_time: `${startH}:${startM}:00`,
      end_time: `${endH}:${endM}:00`,
    });
    
    startMins += durationMins + bufferMins;
  }
  return slots;
}

export default function UserSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookedSlots, setBookedSlots] = useState<{ date: string; start_time: string; status: string }[]>([]);

  // Booking dialog
  const [bookingSlot, setBookingSlot] = useState<{ start_time: string; end_time: string } | null>(null);
  const [bookingSuccessSlot, setBookingSuccessSlot] = useState<{ start_time: string; end_time: string } | null>(null);
    const [selectedMeetingType, setSelectedMeetingType] = useState<any>(null);
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
      const res = await fetch(`/api/my-bookings?email=${encodeURIComponent(lookupEmail)}&ownerId=${userId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLookupResults(data.bookings || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to search bookings.");
    } finally {
      setSearchingBookings(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Prefill booking info
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (myProfile) {
        setBookName(myProfile.display_name);
        setBookEmail(myProfile.email);
      }

      // Get target profile
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
            setProfile(targetProfile);
      if (targetProfile?.meeting_types && targetProfile.meeting_types.length > 0) {
        setSelectedMeetingType(targetProfile.meeting_types[0]);
      }

      // Check connection
      const { data: conn } = await supabase
        .from("connections")
        .select("status")
        .or(
          `and(requester_id.eq.${user.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${user.id})`
        )
        .eq("status", "accepted")
        .limit(1);

      const connected = (conn && conn.length > 0) || user.id === userId;
      setIsConnected(connected);

      if (connected) {
        // Fetch schedules that have accepted bookings
        const { data: schedules } = await supabase
          .from("schedules")
          .select("date, start_time, status")
          .eq("owner_id", userId);

        if (schedules) {
          setBookedSlots(
            schedules.map((s: any) => ({
              date: s.date,
              start_time: s.start_time,
              status: s.status,
            }))
          );
        }
      }

      setLoading(false);
    };
    init();
  }, [userId]);

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const today = startOfDay(new Date());
  const isPastDate = isBefore(startOfDay(selectedDate), today);

  const allSlots = useMemo(() => {
    return generateDaySlots(
      formattedDate, 
      selectedMeetingType?.duration_mins || 60, 
      profile?.buffer_time_mins || 0,
      profile?.timezone || 'UTC'
    );
  }, [formattedDate, selectedMeetingType, profile]);

  const slotsWithStatus = useMemo(() => {
    if (isPastDate) return [];
    return allSlots.map((slot) => {
      const booked = bookedSlots.find(
        (b) => b.date === slot.date && b.start_time === slot.start_time
      );
      return { ...slot, isBooked: !!booked, status: booked?.status };
    });
  }, [allSlots, bookedSlots, isPastDate, formattedDate]);

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
          meetingType: selectedMeetingType?.name,
        }),
      });

      const data = await res.json();
      if (res.status !== 200) {
        throw new Error(data.error || "Booking failed.");
      }

      toast.success("🎉 Booking request sent!");
      setBookingSuccessSlot(bookingSlot);
      // Update booked slots locally
      setBookedSlots((prev) => [
        ...prev,
        { date: formattedDate, start_time: bookingSlot.start_time, status: "Upcoming" },
      ]);
    } catch (err: any) {
      toast.error(err.message || "An error occurred during booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-6">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold mb-2">Not Connected</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          You need to be connected with {profile?.display_name || "this person"} to view their schedule.
        </p>
        <Link 
          href="/people"
          className={cn(buttonVariants({}), "gap-2 glow-primary")}
        >
          <ArrowLeft className="w-4 h-4" />
          Go to People
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* User info */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name} className="w-16 h-16 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{profile?.display_name}'s Schedule</h2>
            <p className="text-sm text-muted-foreground">{profile?.occupation ? `${profile.occupation} • ${profile.email}` : profile?.email}</p>
            {profile?.bio && <p className="text-sm mt-1 max-w-xl">{profile.bio}</p>}
            {profile?.timezone && <p className="text-xs text-primary mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> All times are in {profile.timezone}</p>}
          </div>
        </div>
      </div>

      {profile?.meeting_types && profile.meeting_types.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3">Select Meeting Type</h3>
          <div className="flex flex-wrap gap-2">
            {profile.meeting_types.map((mt: any) => (
              <Button 
                key={mt.name} 
                variant={selectedMeetingType?.name === mt.name ? "default" : "outline"}
                onClick={() => setSelectedMeetingType(mt)}
                className="gap-2"
              >
                {mt.name} ({mt.duration_mins} min)
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Calendar & Track Bookings */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="glass-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5 text-[var(--status-upcoming)]" />
                Select a Date
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { if (date) setSelectedDate(date); }}
                className="rounded-xl"
                modifiers={{ available: datesWithAvailability }}
                modifiersClassNames={{ available: "font-semibold text-[var(--status-upcoming)]" }}
                disabled={(date) => isBefore(startOfDay(date), today)}
              />
            </CardContent>
          </Card>


        </div>

        {/* Middle Column: Available Slots */}
        <div className="lg:col-span-9">
          <Card className="glass-card border-white/5 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5 text-[var(--status-completed)]" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto pr-2">
              {isPastDate ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>This date has already passed.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {slotsWithStatus.map((slot) => (
                    <div
                      key={slot.id}
                      className={`slot-card p-4 rounded-xl border flex items-center justify-between gap-3 ${
                        slot.isBooked
                          ? "border-white/5 bg-white/[0.01] opacity-50"
                          : "border-white/5 bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          slot.isBooked ? "bg-muted/30" : "bg-primary/10"
                        }`}>
                          <Clock className={`w-4 h-4 ${slot.isBooked ? "text-muted-foreground" : "text-primary"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.isBooked ? "Booked" : "Available"}
                          </p>
                        </div>
                      </div>
                      {slot.isBooked ? (
                        <Badge className="bg-white/5 border border-white/10 text-xs">
                          Booked
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="glow-primary text-xs px-3"
                          onClick={() => setBookingSlot({ start_time: slot.start_time, end_time: slot.end_time })}
                        >
                          <CalendarPlus className="w-3.5 h-3.5 mr-1" />
                          Book
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!bookingSlot || !!bookingSuccessSlot} onOpenChange={(open) => {
        if (!open) {
          setBookingSlot(null);
          setBookingSuccessSlot(null);
          setBookReason("");
        }
      }}>
        <DialogContent>
          {bookingSuccessSlot ? (
            <>
              <DialogHeader>
                <DialogTitle>Booking Requested!</DialogTitle>
                <DialogDescription>
                  Your booking request for {formatTime(bookingSuccessSlot.start_time)} – {formatTime(bookingSuccessSlot.end_time)} on {formattedDate} has been sent.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2">
                  <CalendarPlus className="w-8 h-8" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Don't forget to add this to your calendar!
                </p>
                <AddToCalendar event={{
                  title: `Meeting with ${profile?.display_name}`,
                  description: bookReason,
                  startTime: new Date(`${formattedDate}T${bookingSuccessSlot.start_time}`),
                  endTime: new Date(`${formattedDate}T${bookingSuccessSlot.end_time}`)
                }} />
              </div>
              <DialogFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  setBookingSlot(null);
                  setBookingSuccessSlot(null);
                  setBookReason("");
                }}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Book Appointment with {profile?.display_name}</DialogTitle>
                <DialogDescription>
                  {bookingSlot && `${formatTime(bookingSlot.start_time)} – ${formatTime(bookingSlot.end_time)} on ${formattedDate}`}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBook} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Your Name</Label>
                  <Input required value={bookName} onChange={(e) => setBookName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input required type="email" value={bookEmail} onChange={(e) => setBookEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input required value={bookReason} onChange={(e) => setBookReason(e.target.value)} placeholder="I'd like to discuss..." />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting} className="w-full glow-primary">
                    {submitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
