"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Schedule } from "@/types";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import BookingForm from "./BookingForm";
import { Clock, CalendarDays, Sparkles } from "lucide-react";

// Generate 1-hour slots from 5 AM to 11 PM
function generateDaySlots(dateStr: string) {
  const slots = [];
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  let yyyy, mm, dd, hh;
  for (const part of parts) {
    if (part.type === 'year') yyyy = part.value;
    if (part.type === 'month') mm = part.value;
    if (part.type === 'day') dd = part.value;
    if (part.type === 'hour') hh = part.value;
  }
  const todayDate = `${yyyy}-${mm}-${dd}`;
  const currentHour = hh === '24' ? 0 : parseInt(hh || '0', 10);
  const isToday = dateStr === todayDate;

  for (let hour = 5; hour < 23; hour++) {
    if (hour === 12) continue;
    if (isToday && hour <= currentHour) continue;

    const startH = String(hour).padStart(2, "0");
    const endH = String(hour + 1).padStart(2, "0");
    slots.push({
      id: `${dateStr}-${startH}`,
      date: dateStr,
      start_time: `${startH}:00:00`,
      end_time: `${endH}:00:00`,
      title: `Available Slot`,
      description: null,
      category: "Meeting" as const,
      status: "Upcoming" as const,
      owner_id: "",
      created_at: "",
      updated_at: "",
    });
  }
  return slots;
}

export default function AvailabilityCalendar() {
  const [bookedSlots, setBookedSlots] = useState<{ date: string; start_time: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const fetchBookedSlots = async () => {
      setLoading(true);
      // Fetch all accepted bookings to know which slots are taken
      const { data, error } = await supabase
        .from("bookings")
        .select("schedule:schedules(date, start_time), booking_status")
        .in("booking_status", ["Accepted", "Accepted with Remarks"]);

      if (!error && data) {
        const booked = data
          .filter((b: any) => b.schedule)
          .map((b: any) => ({
            date: b.schedule.date,
            start_time: b.schedule.start_time,
          }));
        setBookedSlots(booked);
      }

      // Also fetch schedules that are Cancelled or Completed
      const { data: closedSchedules } = await supabase
        .from("schedules")
        .select("date, start_time")
        .in("status", ["Cancelled", "Completed"]);

      if (closedSchedules) {
        setBookedSlots((prev) => [
          ...prev,
          ...closedSchedules.map((s: any) => ({
            date: s.date,
            start_time: s.start_time,
          })),
        ]);
      }

      setLoading(false);
    };

    fetchBookedSlots();
  }, []);

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const today = startOfDay(new Date());
  const isPastDate = isBefore(startOfDay(selectedDate), today);

  // Generate all 18 hourly slots for the selected date
  const allSlots = useMemo(() => generateDaySlots(formattedDate), [formattedDate]);

  // Filter out booked slots
  const availableSlots = useMemo(() => {
    if (isPastDate) return [];
    return allSlots.filter(
      (slot) =>
        !bookedSlots.some(
          (b) => b.date === slot.date && b.start_time === slot.start_time
        )
    );
  }, [allSlots, bookedSlots, isPastDate, formattedDate]);

  // Next 30 days have availability indicator
  const datesWithAvailability = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 30; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, []);

  const formatTime = (t: string) => {
    const hour = parseInt(t.slice(0, 2));
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:00 ${ampm}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Calendar */}
      <div className="lg:col-span-2">
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
              onSelect={(date) => {
                if (date) setSelectedDate(date);
              }}
              className="rounded-xl"
              modifiers={{
                available: datesWithAvailability,
              }}
              modifiersClassNames={{
                available:
                  "font-semibold text-[var(--status-upcoming)]",
              }}
              disabled={(date) => isBefore(startOfDay(date), today)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Slots */}
      <div className="lg:col-span-3">
        <Card className="glass-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-[var(--status-completed)]" />
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isPastDate
                ? "Cannot book past dates"
                : `${availableSlots.length} slots available`}
            </p>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto pr-2">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isPastDate ? (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>This date has already passed.</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>All slots are booked for this date!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableSlots.map((slot) => (
                  <div
                    key={slot.id}
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
                        <p className="text-xs text-muted-foreground">1 hour</p>
                      </div>
                    </div>
                    <BookingForm
                      date={formattedDate}
                      startTime={slot.start_time}
                      endTime={slot.end_time}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
