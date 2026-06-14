"use client";

import { useDashboard } from "./DashboardContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseISO, format } from "date-fns";

export default function CalendarView() {
  const { selectedDate, setSelectedDate, schedules } = useDashboard();

  // Create an array of Date objects for dates that have schedules
  const datesWithSchedules = schedules.map(s => {
    // schedules.date is "YYYY-MM-DD", appending time to make it valid local date or just parseISO
    // Because date-fns parseISO "2024-01-01" assumes UTC and might shift depending on local timezone
    // It's safer to split and create local date to match what DayPicker uses
    const [year, month, day] = s.date.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
  });

  return (
    <Card className="flex-1 flex flex-col">
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex justify-center items-start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) setSelectedDate(date);
          }}
          className="rounded-md border shadow"
          modifiers={{
            hasSchedule: datesWithSchedules
          }}
          modifiersClassNames={{
            hasSchedule: "font-bold text-primary underline underline-offset-4 decoration-2"
          }}
        />
      </CardContent>
    </Card>
  );
}
