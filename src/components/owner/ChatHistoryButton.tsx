"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import ChatHistorySidebar from "@/components/chatbot/ChatHistorySidebar";

export default function ChatHistoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" className="gap-2 text-xs hover:bg-white/5">
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Chat History</span>
        </Button>
      } />
      <DialogContent className="max-w-md bg-transparent border-none shadow-none p-0 overflow-hidden">
        <DialogTitle className="sr-only">Chat History</DialogTitle>
        <ChatHistorySidebar />
      </DialogContent>
    </Dialog>
  );
}
