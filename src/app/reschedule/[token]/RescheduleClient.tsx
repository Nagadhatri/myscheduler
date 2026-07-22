"use client";

import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isBefore, startOfDay, addDays } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, Clock, CheckCircle } from "lucide-react";

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

export default function RescheduleClient({ booking, owner, token, bookedSlots }: any) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const today = startOfDay(new Date());
  const isPastDate = isBefore(startOfDay(selectedDate), today);

  const durationMins = owner.meeting_types?.find((m: any) => m.name === booking.meeting_type)?.duration_mins || 60;

  const allSlots = useMemo(() => {
    return generateDaySlots(
      formattedDate, 
      durationMins, 
      owner.buffer_time_mins || 0,
      owner.timezone || 'UTC'
    );
  }, [formattedDate, durationMins, owner]);

  const slotsWithStatus = useMemo(() => {
    if (isPastDate) return [];
    return allSlots.map((slot) => {
      const booked = bookedSlots.find(
        (b: any) => b.date === slot.date && b.start_time === slot.start_time
      );
      // Don't mark as booked if it's the CURRENT slot of the booking being rescheduled
      const isCurrentSlot = booking.schedules.date === slot.date && booking.schedules.start_time === slot.start_time;
      return { ...slot, isBooked: !!booked && !isCurrentSlot, status: booked?.status };
    });
  }, [allSlots, bookedSlots, isPastDate, booking]);

  const datesWithAvailability = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 30; i++) dates.push(addDays(today, i));
    return dates;
  }, []);

  const formatTime = (t: string) => {
    const hour = parseInt(t.slice(0, 2));
    const min = t.slice(3, 5);
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${min} ${ampm}`;
  };

  const handleReschedule = async (slot: any) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/reschedule-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newDate: formattedDate,
          newStartTime: slot.start_time,
          newEndTime: slot.end_time,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reschedule failed");

      setSuccess(true);
      toast.success("Meeting rescheduled successfully!");
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <CheckCircle className="w-16 h-16 text-green-500 mb-6" />
        <h2 className="text-2xl font-bold mb-2">Rescheduled Successfully!</h2>
        <p className="text-muted-foreground mb-6">Your meeting has been updated. A confirmation email will be sent shortly.</p>
        <Button onClick={() => window.location.href = '/'}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Reschedule Meeting</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Pick a new time for your <b>{booking.meeting_type || 'Standard'}</b> meeting with <b>{owner.display_name}</b>.
        </p>
        <p className="text-sm mt-2 text-primary">All times are in {owner.timezone || 'UTC'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Select a Date</CardTitle>
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
          
          <Card className="glass-card bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">Current Meeting</CardTitle>
              <CardDescription>
                {format(new Date(booking.schedules.date), "EEEE, MMMM d, yyyy")}
                <br />
                {formatTime(booking.schedules.start_time)} – {formatTime(booking.schedules.end_time)}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5" />
                Available Times on {format(selectedDate, "MMM d")}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto pr-2">
              <div className="flex flex-col gap-3">
                {slotsWithStatus.map((slot) => (
                  <div
                    key={slot.id}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                      slot.isBooked ? "bg-muted/30 opacity-50" : "bg-white/[0.02]"
                    }`}
                  >
                    <div>
                      <p className="font-medium">
                        {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      </p>
                    </div>
                    {slot.isBooked ? (
                      <Badge variant="secondary">Booked</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleReschedule(slot)}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
