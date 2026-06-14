"use client";

import { useState } from "react";
import { useDashboard } from "./DashboardContext";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Schedule, ScheduleCategory, ScheduleStatus } from "@/types";
import { Trash2, Edit } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const getStatusColor = (status: ScheduleStatus) => {
  switch (status) {
    case 'Upcoming': return 'bg-[var(--status-upcoming)]';
    case 'Completed': return 'bg-[var(--status-completed)]';
    case 'Rescheduled': return 'bg-[var(--status-rescheduled)]';
    case 'Cancelled': return 'bg-[var(--status-cancelled)]';
    default: return 'bg-gray-500';
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
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const daySchedules = schedules.filter(s => s.date === formattedDate);

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
    
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Schedule deleted");
      fetchSchedules();
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
      status
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase.from('schedules').update(payload).eq('id', editingId);
      error = updateError;
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Not authenticated");
        setLoading(false);
        return;
      }
      const { error: insertError } = await supabase.from('schedules').insert({
        ...payload,
        owner_id: userData.user.id
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
    <Card className="flex-1 flex flex-col h-[600px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Schedules for {format(selectedDate, "MMM d, yyyy")}</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm">Add Slot</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Slot" : "Add Slot"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input required value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ScheduleCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Presentation">Presentation</SelectItem>
                    <SelectItem value="Event Participation">Event Participation</SelectItem>
                    <SelectItem value="Learning">Learning</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingId && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as ScheduleStatus)}>
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
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 py-2">
          {daySchedules.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No schedules for this date.</p>
          ) : (
            <div className="space-y-4">
              {daySchedules.map(s => (
                <div key={s.id} className="p-4 border rounded-lg flex flex-col space-y-2 bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{s.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)} | {s.category}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm truncate max-w-[250px]" title={s.description || ""}>
                      {s.description}
                    </p>
                    <Badge className={`${getStatusColor(s.status)} text-white border-none hover:${getStatusColor(s.status)}/80`}>
                      {s.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
