"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import BookingHistory from "./BookingHistory";

export default function BookingHistoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-full flex items-center gap-2 justify-start bg-card/50 backdrop-blur-xl border border-white/5 hover:bg-white/5 h-12 px-4 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
        <History className="w-4 h-4 text-primary" />
        <span>Track My Bookings</span>
      </DialogTrigger>
      <DialogContent className="max-w-xl bg-card border border-white/10 p-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Booking History</DialogTitle>
        <BookingHistory />
      </DialogContent>
    </Dialog>
  );
}
