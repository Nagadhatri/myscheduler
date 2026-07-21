"use client";

import { useDashboard } from "./DashboardContext";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Plus } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function CalendarView() {
  const { selectedDate, setSelectedDate, schedules, fetchSchedules, loadingSchedules } = useDashboard();

  const datesWithSchedules = schedules.map((s) => {
    const [year, month, day] = s.date.split("-");
    return new Date(Number(year), Number(month) - 1, Number(day));
  });

  const supabase = createClient();

  const CustomDayButton = (props: any) => {
    const dateStr = props.day?.date ? format(props.day.date, "yyyy-MM-dd") : null;
    const daySchedules = dateStr ? schedules.filter(s => s.date === dateStr) : [];

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      const slotId = e.dataTransfer.getData("slotId");
      if (slotId && dateStr) {
        const { error } = await supabase.from("schedules").update({ date: dateStr }).eq("id", slotId);
        if (error) {
          toast.error("Failed to reschedule: " + error.message);
        } else {
          toast.success("Rescheduled slot!");
          fetchSchedules(); // fetch using context method
        }
      }
    };

    return (
      <TooltipProvider delay={100}>
        <Tooltip>
          <TooltipTrigger render={
            <div 
              className="relative group w-full h-full flex items-center justify-center cursor-pointer"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/20", "rounded-md"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("bg-primary/20", "rounded-md"); }}
              onDrop={(e) => { e.currentTarget.classList.remove("bg-primary/20", "rounded-md"); handleDrop(e); }}
            >
              <CalendarDayButton {...props} />
              {dateStr && (
                 <Button
                   variant="ghost"
                   size="icon"
                   className="absolute -top-1 -right-1 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/80 rounded-full z-20 shadow-md"
                   onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedDate(props.day.date);
                      window.dispatchEvent(new CustomEvent("open-add-slot"));
                   }}
                 >
                   <Plus className="w-3 h-3" />
                 </Button>
              )}
            </div>
          } />
          {daySchedules.length > 0 && props.day?.date && (
            <TooltipContent side="right" className="bg-card/95 border-white/10 p-2 text-xs z-50">
              <div className="font-semibold mb-1">{format(props.day.date, "MMM d")}</div>
              <ul className="space-y-1 max-w-[200px]">
                {daySchedules.map(s => (
                  <li key={s.id} className="flex gap-2">
                     <span className="opacity-70 whitespace-nowrap">{s.start_time.slice(0,5)}</span>
                     <span className="truncate">{s.title}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card className="glass-card border-white/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="w-4 h-4 text-primary" />
          Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center pb-4 min-h-[320px]">
        {loadingSchedules ? (
          <div className="w-full h-[300px] flex items-center justify-center p-4">
             <Skeleton className="w-full h-full rounded-xl bg-white/5" />
          </div>
        ) : (
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
            components={{ DayButton: CustomDayButton }}
          />
        )}
      </CardContent>
    </Card>
  );
}
