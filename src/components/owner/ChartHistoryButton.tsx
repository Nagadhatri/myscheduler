"use client";

import { useState } from "react";
import { History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ChatHistorySidebar from "@/components/chatbot/ChatHistorySidebar";

export default function ChartHistoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" className="w-full gap-2 border-white/10 bg-white/5 hover:bg-white/10 mt-4">
          <History className="w-4 h-4" />
          View Chat History
        </Button>
      } />
      <DialogContent className="max-w-md bg-transparent border-none shadow-none p-0 overflow-hidden">
        <ChatHistorySidebar />
      </DialogContent>
    </Dialog>
  );
}
