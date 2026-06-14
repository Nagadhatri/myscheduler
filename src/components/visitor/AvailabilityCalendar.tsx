"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Schedule } from "@/types";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import BookingForm from "./BookingForm";

export default function AvailabilityCalendar() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true);
      // Fetch upcoming schedules
      const { data, error } = await supabase
        .from('schedules')
        .select('*, bookings(booking_status)')
        .eq('status', 'Upcoming');
        
      if (!error && data) {
        // Filter out schedules that have an Accepted booking
        const available = data.filter((s: any) => {
          const hasAccepted = s.bookings?.some((b: any) => b.booking_status === 'Accepted');
          return !hasAccepted;
        });
        setSchedules(available as Schedule[]);
      }
      setLoading(false);
    };

    fetchSchedules();
  }, []);

  const datesWithAvailability = schedules.map(s => {
    const [year, month, day] = s.date.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
  });

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = schedules.filter(s => s.date === formattedDate);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Select a Date</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) setSelectedDate(date);
            }}
            className="rounded-md border shadow"
            modifiers={{
              available: datesWithAvailability
            }}
            modifiersClassNames={{
              available: "font-bold text-primary bg-primary/10 rounded-full"
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Slots - {format(selectedDate, "MMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : daySchedules.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No available slots on this date.</p>
          ) : (
            <div className="space-y-4">
              {daySchedules.map(s => (
                <div key={s.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div>
                    <h4 className="font-medium text-lg">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</h4>
                    <p className="text-sm text-muted-foreground">{s.title}</p>
                    {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                  </div>
                  <BookingForm schedule={s} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
