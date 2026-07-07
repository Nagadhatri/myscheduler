"use client";

import { useDashboard } from "@/components/owner/DashboardContext";
import { useChatHistory } from "./useChatHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, MessageCircle, Calendar } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { useEffect } from "react";

export default function ChatHistorySidebar() {
  const { selectedChatDate, setSelectedChatDate } = useDashboard();
  const { chatDates, refreshDates } = useChatHistory("owner");

  // Keep dates fresh when they change in other components
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("myscheduler_chat_owner_")) {
        refreshDates();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshDates]);

  // Initial select today if it exists, otherwise just null
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <Card className="glass-card border-white/10 overflow-hidden">
      <CardHeader className="bg-white/[0.02] border-b border-white/5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <History className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-white">Chat History</CardTitle>
              <p className="text-[10px] text-muted-foreground">Recover past conversations</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs hover:bg-white/5 px-2"
            onClick={() => setSelectedChatDate(todayStr)}
          >
            New Chat
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
          {chatDates.length === 0 ? (
            <div className="text-center py-6">
              <MessageCircle className="w-6 h-6 mx-auto mb-2 text-primary/30" />
              <p className="text-xs text-muted-foreground">No chat history found.</p>
            </div>
          ) : (
            chatDates.map((dateStr) => {
              const isSelected = selectedChatDate === dateStr || (!selectedChatDate && dateStr === todayStr);
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedChatDate(dateStr)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {isToday(parseISO(dateStr)) ? "Today" : format(parseISO(dateStr), "MMM d, yyyy")}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
