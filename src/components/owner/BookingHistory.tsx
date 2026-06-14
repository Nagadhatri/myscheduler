"use client";

import { useDashboard } from "./DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BookingStatusType, Schedule } from "@/types";

export default function BookingHistory() {
  const { bookings } = useDashboard();
  
  const historyBookings = bookings.filter(b => b.booking_status !== 'Pending');

  const getStatusColor = (status: BookingStatusType) => {
    switch (status) {
      case 'Accepted': return 'bg-green-500 hover:bg-green-600';
      case 'Accepted with Remarks': return 'bg-emerald-500 hover:bg-emerald-600';
      case 'Rejected': return 'bg-red-500 hover:bg-red-600';
      case 'Cancelled': return 'bg-gray-500 hover:bg-gray-600';
      case 'Rescheduled': return 'bg-orange-500 hover:bg-orange-600';
      default: return 'bg-primary';
    }
  };

  return (
    <Card className="flex-1 flex flex-col h-[276px]">
      <CardHeader className="py-3 border-b">
        <CardTitle className="text-lg">History</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 py-2">
          {historyBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No history available.</p>
          ) : (
            <div className="space-y-3">
              {historyBookings.map((b) => {
                const s = (b as any).schedule as Schedule;
                return (
                  <div key={b.id} className="p-3 border rounded-md bg-muted/10 text-sm space-y-1">
                    <div className="flex justify-between items-start">
                      <div className="font-medium">{b.visitor_name}</div>
                      <Badge className={`${getStatusColor(b.booking_status)} text-white border-none`}>
                        {b.booking_status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s?.date} ({s?.start_time.slice(0,5)} - {s?.end_time.slice(0,5)})
                    </div>
                    {b.owner_remarks && (
                      <div className="text-xs italic bg-background p-1 mt-1 rounded border">
                        Owner: {b.owner_remarks}
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
