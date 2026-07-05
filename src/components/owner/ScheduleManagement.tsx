"use client";

import { useState } from "react";
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
import { Trash2, Edit, Plus, Clock, ListChecks, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const getCategoryEmoji = (cat: string) => {
  switch (cat) {
    case "Meeting":
      return "🤝";
    case "Presentation":
      return "📊";
    case "Event Participation":
      return "🎪";
    case "Learning":
      return "📚";
    default:
      return "📌";
  }
};

export default function ScheduleManagement() {
  const { selectedDate, schedules, fetchSchedules } = useDashboard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ScheduleCategory>("Meeting");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<ScheduleStatus>("Upcoming");
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleEnd, setRescheduleEnd] = useState("");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = schedules.filter((s) => s.date === formattedDate);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setCategory("Meeting");
    setDescription("");
    setStartTime("");
    setEndTime("");
    setStatus("Upcoming");
  };

  const handleEdit = (s: Schedule) => {
    setEditingId(s.id);
    setTitle(s.title);
    setCategory(s.category);
    setDescription(s.description || "");
    setStartTime(s.start_time.slice(0, 5));
    setEndTime(s.end_time.slice(0, 5));
    setStatus(s.status);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this slot?")) return;

    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Schedule deleted");
      fetchSchedules();
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleId) return;
    setLoading(true);

    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: rescheduleId,
          newDate: rescheduleDate,
          newStartTime: rescheduleStart,
          newEndTime: rescheduleEnd,
          reason: rescheduleReason || "No reason provided by the host.",
        }),
      });

      const data = await res.json();
      if (res.status !== 200) {
        throw new Error(data.error || "Failed to reschedule.");
      }

      toast.success(data.message || "Meeting rescheduled! ✅");
      setRescheduleDialogOpen(false);
      setRescheduleId(null);
      setRescheduleReason("");
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      title,
      category,
      description,
      date: formattedDate,
      start_time: startTime + ":00",
      end_time: endTime + ":00",
      status,
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
      resetForm();
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
            if (!open) resetForm();
          }}
        >
          <DialogTrigger
            render={
              <Button size="sm" className="gap-1.5 glow-primary text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Slot
              </Button>
            }
          >
            Add Slot
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Slot" : "Add Slot"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as ScheduleCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Meeting">🤝 Meeting</SelectItem>
                    <SelectItem value="Presentation">📊 Presentation</SelectItem>
                    <SelectItem value="Event Participation">🎪 Event Participation</SelectItem>
                    <SelectItem value="Learning">📚 Learning</SelectItem>
                    <SelectItem value="Other">📌 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingId && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as ScheduleStatus)}
                  >
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
                </div>
              )}
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
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
          {daySchedules.length === 0 ? (
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
                  className="slot-card p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span>{getCategoryEmoji(s.category)}</span>
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
                            setRescheduleDate(s.date);
                            setRescheduleStart(s.start_time.slice(0,5));
                            setRescheduleEnd(s.end_time.slice(0,5));
                            setRescheduleDialogOpen(true);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-[var(--status-rescheduled)]" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-red-500/10"
                        title="Delete"
                        onClick={() => handleDelete(s.id)}
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
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Input type="date" required value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Start Time</Label>
                <Input type="time" required value={rescheduleStart} onChange={(e) => setRescheduleStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New End Time</Label>
                <Input type="time" required value={rescheduleEnd} onChange={(e) => setRescheduleEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason for Rescheduling (Will be emailed to the attendee)</Label>
              <Input
                required
                placeholder="e.g. Urgent conflict came up, double booked..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="glow-primary">
                {loading ? "Rescheduling..." : "Reschedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
