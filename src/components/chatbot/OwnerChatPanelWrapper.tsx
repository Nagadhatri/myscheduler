"use client";

import { useState } from "react";
import { useDashboard } from "@/components/owner/DashboardContext";
import ChatPanel from "./ChatPanel";
import { ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OwnerChatPanelWrapper() {
  const { selectedChatDate } = useDashboard();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex flex-col border border-white/10 rounded-2xl bg-card/50 backdrop-blur-md overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer bg-black/20 hover:bg-black/30 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" className="w-6 h-6 rounded-full">
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>
      
      {!isCollapsed && (
        <div className="h-[600px] border-t border-white/5">
          <ChatPanel context="owner" mode="inline" selectedChatDate={selectedChatDate} />
        </div>
      )}
    </div>
  );
}
