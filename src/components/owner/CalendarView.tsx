"use client";

import { useDashboard } from "./DashboardContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export default function CalendarView() {
  const { selectedDate, setSelectedDate, schedules } = useDashboard();

  const datesWithSchedules = schedules.map((s) => {
    const [year, month, day] = s.date.split("-");
    return new Date(Number(year), Number(month) - 1, Number(day));
  });

  return (
    <Card className="glass-card border-white/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="w-4 h-4 text-primary" />
          Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center pb-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) setSelectedDate(date);
          }}
          className="rounded-xl"
          modifiers={{
            hasSchedule: datesWithSchedules,
          }}
          modifiersClassNames={{
            hasSchedule:
              "font-bold text-[var(--status-upcoming)] bg-[var(--status-upcoming)]/10 rounded-full",
          }}
        />
      </CardContent>
    </Card>
  );
}
