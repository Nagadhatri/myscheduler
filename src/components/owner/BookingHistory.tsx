"use client";

import { useState } from "react";
import { useDashboard } from "./DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookingStatusType, Schedule } from "@/types";
import { History, Clock, CheckCircle2, XCircle, AlertCircle, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export default function BookingHistory() {
  const { bookings } = useDashboard();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  const historyBookings = bookings.filter(
    (b) => {
      if (b.booking_status === "Pending") return false;
      if (statusFilter !== "All" && b.booking_status !== statusFilter) return false;
      
      const s = (b as any).schedule as Schedule;
      if (dateFilter && s?.date !== dateFilter) return false;

      if (!searchQuery.trim()) return true;
      const lowerQ = searchQuery.toLowerCase();
      return b.visitor_name.toLowerCase().includes(lowerQ) || b.booking_status.toLowerCase().includes(lowerQ);
    }
  );

  const getStatusIcon = (status: BookingStatusType) => {
    switch (status) {
      case "Accepted":
      case "Accepted with Remarks":
        return <CheckCircle2 className="w-3 h-3" />;
      case "Rejected":
      case "Cancelled":
        return <XCircle className="w-3 h-3" />;
      default:
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: BookingStatusType) => {
    switch (status) {
      case "Accepted":
      case "Accepted with Remarks":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
      case "Rejected":
        return "bg-red-500/15 text-red-400 border-red-500/20";
      case "Cancelled":
        return "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
      case "Rescheduled":
        return "bg-orange-500/15 text-orange-400 border-orange-500/20";
      default:
        return "bg-primary/15 text-primary border-primary/20";
    }
  };

  return (
    <Card className="glass-card border-white/5">
      <CardHeader className="py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-muted-foreground" />
            History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger render={
                <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-white/5 relative">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  {(statusFilter !== "All" || dateFilter) && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
              } />
              <PopoverContent align="end" className="w-56 p-3 space-y-3 bg-card/95 border-white/10 backdrop-blur-xl z-50">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "All")}>
                    <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="Accepted">Accepted</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Date</label>
                  <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-8 text-xs bg-white/5 border-white/10" />
                </div>
                {(statusFilter !== "All" || dateFilter) && (
                  <Button variant="ghost" className="w-full text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setStatusFilter("All"); setDateFilter(""); }}>
                    Clear Filters
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            <div className="relative w-36">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-7 text-xs bg-white/5 border-white/10"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[250px] px-6 py-2">
          {historyBookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No history found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyBookings.map((b) => {
                const s = (b as any).schedule as Schedule;
                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl border border-white/5 bg-white/[0.02] text-sm space-y-1.5"
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-sm">
                        {b.visitor_name}
                      </div>
                      <Badge
                        className={`${getStatusColor(b.booking_status)} border text-xs gap-1`}
                      >
                        {getStatusIcon(b.booking_status)}
                        {b.booking_status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {s?.date} ({s?.start_time?.slice(0, 5)} –{" "}
                      {s?.end_time?.slice(0, 5)})
                    </div>
                    {b.owner_remarks && (
                      <div className="text-xs bg-primary/5 border border-primary/10 p-2 rounded-lg mt-1">
                        <span className="font-semibold text-primary">
                          Your remark:
                        </span>{" "}
                        {b.owner_remarks}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
