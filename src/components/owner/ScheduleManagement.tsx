"use client";

import { useState, useEffect } from "react";
import { useDashboard } from "./DashboardContext";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Schedule, ScheduleCategory, ScheduleStatus } from "@/types";
import { Trash2, Edit, Plus, Clock, ListChecks, RefreshCw, FileText, Users, BarChart3, Tent, BookOpen, Pin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MeetingMinutesDialog from "./MeetingMinutesDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const getStatusColor = (status: ScheduleStatus) => {
  switch (status) {
    case "Upcoming":
      return "bg-[var(--status-upcoming)]/15 text-[var(--status-upcoming)] border-[var(--status-upcoming)]/20";
    case "Completed":
      return "bg-[var(--status-completed)]/15 text-[var(--status-completed)] border-[var(--status-completed)]/20";
    case "Rescheduled":
      return "bg-[var(--status-rescheduled)]/15 text-[var(--status-rescheduled)] border-[var(--status-rescheduled)]/20";
    case "Cancelled":
      return "bg-[var(--status-cancelled)]/15 text-[var(--status-cancelled)] border-[var(--status-cancelled)]/20";
    default:
      return "bg-zinc-500/15 text-zinc-400";
  }
};

const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case "Meeting":
      return <Users className="w-4 h-4 text-blue-400" />;
    case "Presentation":
      return <BarChart3 className="w-4 h-4 text-purple-400" />;
    case "Event Participation":
      return <Tent className="w-4 h-4 text-orange-400" />;
    case "Learning":
      return <BookOpen className="w-4 h-4 text-green-400" />;
    default:
      return <Pin className="w-4 h-4 text-zinc-400" />;
  }
};

const scheduleSchema = z.object({
  title: z.string().min(2, "Title is required"),
  category: z.string(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time"),
  description: z.string().optional(),
  status: z.string(),
}).refine(data => data.startTime < data.endTime, {
  message: "Start time must be before end time",
  path: ["endTime"],
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

const rescheduleSchema = z.object({
  newDate: z.string().min(1, "Date is required"),
  newStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time"),
  newEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time"),
  reason: z.string().min(5, "Reason is required (min 5 chars)"),
}).refine(data => data.newStartTime < data.newEndTime, {
  message: "Start time must be before end time",
  path: ["newEndTime"],
});
type RescheduleFormData = z.infer<typeof rescheduleSchema>;

export default function ScheduleManagement() {
  const { selectedDate, schedules, fetchSchedules, loadingSchedules } = useDashboard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // MoM state
  const [momDialogOpen, setMomDialogOpen] = useState(false);
  const [selectedMomSchedule, setSelectedMomSchedule] = useState<Schedule | null>(null);

  const supabase = createClient();
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = schedules.filter((s) => s.date === formattedDate);

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      title: "",
      category: "Meeting",
      startTime: "",
      endTime: "",
      description: "",
      status: "Upcoming"
    }
  });

  const { register: registerRe, handleSubmit: handleSubmitRe, reset: resetRe, formState: { errors: errorsRe } } = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      newDate: "",
      newStartTime: "",
      newEndTime: "",
      reason: ""
    }
  });

  useEffect(() => {
    const handleOpenAddSlot = () => {
      setEditingId(null);
      reset();
      setIsDialogOpen(true);
    };
    window.addEventListener("open-add-slot", handleOpenAddSlot);
    return () => window.removeEventListener("open-add-slot", handleOpenAddSlot);
  }, [reset]);

  const handleEdit = (s: Schedule) => {
    setEditingId(s.id);
    setValue("title", s.title);
    setValue("category", s.category);
    setValue("description", s.description || "");
    setValue("startTime", s.start_time.slice(0, 5));
    setValue("endTime", s.end_time.slice(0, 5));
    setValue("status", s.status);
    setIsDialogOpen(true);
  };

  const executeDelete = async (id: string) => {
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Schedule deleted");
      fetchSchedules();
    }
  };

  const handleDeleteClick = (id: string) => {
    toast("Are you sure you want to delete this slot?", {
        action: {
            label: "Delete",
            onClick: () => executeDelete(id),
        },
        cancel: {
            label: "Cancel",
            onClick: () => {}
        }
    });
  };

  const handleReschedule = async (data: RescheduleFormData) => {
    if (!rescheduleId) return;
    setLoading(true);

    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: rescheduleId,
          newDate: data.newDate,
          newStartTime: data.newStartTime,
          newEndTime: data.newEndTime,
          reason: data.reason,
        }),
      });

      const resData = await res.json();
      if (res.status !== 200) {
        throw new Error(resData.error || "Failed to reschedule.");
      }

      toast.success(resData.message || "Meeting rescheduled! ✅");
      setRescheduleDialogOpen(false);
      setRescheduleId(null);
      resetRe();
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: ScheduleFormData) => {
    setLoading(true);

    const payload = {
      title: data.title,
      category: data.category as ScheduleCategory,
      description: data.description,
      date: formattedDate,
      start_time: data.startTime + ":00",
      end_time: data.endTime + ":00",
      status: data.status as ScheduleStatus,
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase
        .from("schedules")
        .update(payload)
        .eq("id", editingId);
      error = updateError;
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Not authenticated");
        setLoading(false);
        return;
      }
      const { error: insertError } = await supabase
        .from("schedules")
        .insert({
          ...payload,
          owner_id: userData.user.id,
        });
      error = insertError;
    }

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingId ? "Schedule updated" : "Schedule created");
      setIsDialogOpen(false);
      reset();
      fetchSchedules();
    }
  };

  return (
    <Card className="glass-card border-white/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="w-4 h-4 text-[var(--status-completed)]" />
          {format(selectedDate, "MMM d, yyyy")}
        </CardTitle>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
                setEditingId(null);
                reset();
            }
          }}
        >
          <DialogTrigger render={
            <Button size="sm" className="gap-1.5 glow-primary text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Slot
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Slot" : "Add Slot"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input {...register("title")} />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" {...register("startTime")} />
                  {errors.startTime && <p className="text-red-500 text-xs mt-1">{errors.startTime.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" {...register("endTime")} />
                  {errors.endTime && <p className="text-red-500 text-xs mt-1">{errors.endTime.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Meeting">Meeting</SelectItem>
                        <SelectItem value="Presentation">Presentation</SelectItem>
                        <SelectItem value="Event Participation">Event</SelectItem>
                        <SelectItem value="Learning">Learning</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {editingId && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Upcoming">Upcoming</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Description</Label>
                <Input {...register("description")} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading} className="glow-primary">
                  {loading ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px] px-6 py-3">
          {loadingSchedules ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[80px] w-full rounded-xl bg-white/5" />
              ))}
            </div>
          ) : daySchedules.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No schedules for this date.</p>
              <p className="text-xs mt-1">Click "Add Slot" to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {daySchedules.map((s) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("slotId", s.id)}
                  className="slot-card p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(s.category)}
                        <h4 className="font-semibold text-sm">{s.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        <span className="text-white/20">·</span>
                        {s.category}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-white/5"
                        title="Edit"
                        onClick={() => handleEdit(s)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      {s.status === "Upcoming" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-orange-500/10"
                          title="Reschedule"
                          onClick={() => {
                            setRescheduleId(s.id);
                            resetRe({
                                newDate: s.date,
                                newStartTime: s.start_time.slice(0,5),
                                newEndTime: s.end_time.slice(0,5),
                                reason: ""
                            });
                            setRescheduleDialogOpen(true);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-[var(--status-rescheduled)]" />
                        </Button>
                      )}
                      {s.status === "Completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs hover:bg-emerald-500/10 text-emerald-400 gap-1 border border-emerald-500/20 bg-emerald-500/5 mr-1"
                          onClick={() => {
                            setSelectedMomSchedule(s);
                            setMomDialogOpen(true);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Minutes</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-red-500/10"
                        title="Delete"
                        onClick={() => handleDeleteClick(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {s.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {s.description}
                      </p>
                    )}
                    <Badge className={`${getStatusColor(s.status)} border text-xs ml-auto`}>
                      {s.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => { if (!open) { setRescheduleDialogOpen(false); setRescheduleId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[var(--status-rescheduled)]" />
              Reschedule Meeting
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitRe(handleReschedule)} className="space-y-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Input type="date" {...registerRe("newDate")} />
              {errorsRe.newDate && <p className="text-red-500 text-xs mt-1">{errorsRe.newDate.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Start Time</Label>
                <Input type="time" {...registerRe("newStartTime")} />
                {errorsRe.newStartTime && <p className="text-red-500 text-xs mt-1">{errorsRe.newStartTime.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>New End Time</Label>
                <Input type="time" {...registerRe("newEndTime")} />
                {errorsRe.newEndTime && <p className="text-red-500 text-xs mt-1">{errorsRe.newEndTime.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason for Rescheduling</Label>
              <Input placeholder="e.g. Urgent conflict came up..." className="bg-white/5 border-white/10" {...registerRe("reason")} />
              {errorsRe.reason && <p className="text-red-500 text-xs mt-1">{errorsRe.reason.message}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="glow-primary">
                {loading ? "Rescheduling..." : "Reschedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MeetingMinutesDialog
        open={momDialogOpen}
        onOpenChange={(open) => {
          setMomDialogOpen(open);
          if (!open) setSelectedMomSchedule(null);
        }}
        schedule={selectedMomSchedule}
      />
    </Card>
  );
}
