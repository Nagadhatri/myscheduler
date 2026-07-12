"use client";

import { useState, useEffect, useRef } from "react";
import { useDashboard } from "./DashboardContext";
import { Bell, CheckCircle2, MessageSquare, AlertCircle, FileText, Inbox, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { AppNotification, Booking, BookingStatusType, Schedule } from "@/types";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NotificationsDropdown() {
  const { bookings, fetchBookings } = useDashboard();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // pendingBookings is derived from context
  const pendingBookings = bookings.filter(b => b.booking_status === "Pending");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const prevUnreadCountRef = useRef<number>(0);
  const router = useRouter();

  // Dialog state for booking actions
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionDialog, setActionDialog] = useState<"AcceptWithRemarks" | "Reject" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch Notifications
      const notifRes = await fetch("/api/notifications");
      const notifData = await notifRes.json();
      if (notifData.notifications) {
        setNotifications(notifData.notifications);
        const unread = notifData.notifications.filter((n: AppNotification) => !n.is_read).length;
        setUnreadCount(unread);

        if (unread > prevUnreadCountRef.current) {
          const newNotifs = notifData.notifications.filter((n: AppNotification) => !n.is_read).slice(0, unread - prevUnreadCountRef.current);
          newNotifs.forEach((n: AppNotification) => {
            toast(n.title, {
              description: n.message,
              position: "top-right",
              action: {
                label: "View",
                onClick: () => handleNotificationClick(n)
              }
            });
          });
        }
        prevUnreadCountRef.current = unread;
      }

      // Fetch Bookings via context
      await fetchBookings();
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // poll every 30s
    
    // Also listen for booking updates from elsewhere
    const handleUpdate = () => fetchData();
    window.addEventListener("booking-updated", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("booking-updated", handleUpdate);
    };
  }, []);

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      prevUnreadCountRef.current = 0;
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id] }),
      });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1);
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.type === "report_ready") {
      // open reports panel?
    } else {
      router.push("/dashboard");
    }
  };

  const handleBookingAction = async (bookingId: string, status: BookingStatusType, notes: string = "") => {
    setLoading(true);
    try {
      const res = await fetch("/api/booking-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status, remarks: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(`Booking ${status.toLowerCase()}`);
      setActionDialog(null);
      setRemarks("");
      fetchData();
      
      // Dispatch event to refresh dashboard calendar/history
      window.dispatchEvent(new Event("booking-updated"));
    } catch (error: any) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "booking_request": return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case "booking_accepted": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "booking_rejected": return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "report_ready": return <FileText className="w-4 h-4 text-purple-400" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const totalBadgeCount = unreadCount + pendingBookings.length;

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger render={
          <Button variant="ghost" size="icon" className="relative hover:bg-white/5 w-9 h-9">
            <Bell className="w-4 h-4" />
            {totalBadgeCount > 0 && (
              <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center bg-red-500 text-[9px]">
                {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
              </Badge>
            )}
          </Button>
        } />
        <PopoverContent align="end" className="w-80 p-0 border-white/10 bg-card/95 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-primary hover:bg-transparent">
                Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="h-[350px]">
            {pendingBookings.length === 0 && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                <Bell className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">All caught up!</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Pending Bookings Section */}
                {pendingBookings.length > 0 && (
                  <div className="px-3 py-2 bg-[var(--status-rescheduled)]/5 border-b border-white/5">
                    <h5 className="text-xs font-semibold text-[var(--status-rescheduled)] mb-2 flex items-center gap-1.5">
                      <Inbox className="w-3.5 h-3.5" /> Pending Requests ({pendingBookings.length})
                    </h5>
                    <div className="space-y-2">
                      {pendingBookings.map((b) => {
                        const s = (b as any).schedule as Schedule;
                        return (
                          <div key={b.id} className="p-2.5 rounded-lg border border-white/10 bg-black/20 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-xs">{b.visitor_name}</p>
                                <p className="text-[10px] text-muted-foreground">{b.visitor_email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {s?.title} · {s?.date}
                            </div>
                            {b.description && (
                              <p className="text-[10px] italic text-muted-foreground">"{b.description}"</p>
                            )}
                            <div className="flex gap-1.5 pt-1">
                              <Button size="sm" className="h-6 px-2 text-[10px] gap-1 glow-primary flex-1" onClick={() => handleBookingAction(b.id, "Accepted")}>
                                <Check className="w-3 h-3" /> Accept
                              </Button>
                              <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px] flex-1" onClick={() => { setSelectedBooking(b); setActionDialog("AcceptWithRemarks"); }}>
                                Remarks
                              </Button>
                              <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px] flex-1" onClick={() => { setSelectedBooking(b); setActionDialog("Reject"); }}>
                                <X className="w-3 h-3" /> Reject
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Standard Notifications Section */}
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${!notif.is_read ? "bg-white/[0.02]" : ""}`}
                  >
                    <div className="mt-0.5">{getIcon(notif.type)}</div>
                    <div className="flex-1 space-y-1">
                      <p className={`text-sm leading-tight ${!notif.is_read ? "font-medium" : "text-muted-foreground"}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground/80 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "AcceptWithRemarks" && "Accept with Remarks"}
              {actionDialog === "Reject" && "Reject Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message to Visitor</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="E.g., Please bring your ID."
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={loading}
              className="glow-primary"
              onClick={() => {
                if (selectedBooking && actionDialog) {
                  const statusMap: Record<string, BookingStatusType> = {
                    AcceptWithRemarks: "Accepted with Remarks",
                    Reject: "Rejected",
                  };
                  handleBookingAction(selectedBooking.id, statusMap[actionDialog], remarks);
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
