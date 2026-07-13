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
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 text-xs hover:bg-white/5">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </Button>
        }
      />
      <DialogContent className="max-w-xl bg-card border border-white/10 p-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Booking History</DialogTitle>
        <BookingHistory />
      </DialogContent>
    </Dialog>
  );
}
