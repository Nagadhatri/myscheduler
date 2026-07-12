import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { type UIMessage } from "ai";

export function useChatHistory(context: "owner" | "visitor") {
  const [chatDates, setChatDates] = useState<string[]>([]);

  const loadDates = useCallback(() => {
    const dates = Object.keys(localStorage)
      .filter((k) => k.startsWith(`myscheduler_chat_${context}_`))
      .map((k) => k.replace(`myscheduler_chat_${context}_`, ""))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    setChatDates(dates);
  }, [context]);

  // Load available dates on mount
  useEffect(() => {
    loadDates();
  }, [loadDates]);

  const saveChat = (messages: UIMessage[], dateKey?: string) => {
    if (messages.length === 0) return;
    const finalDate = dateKey || format(new Date(), "yyyy-MM-dd");
    const key = `myscheduler_chat_${context}_${finalDate}`;
    localStorage.setItem(key, JSON.stringify(messages));
    
    setChatDates((prev) => {
      if (!prev.includes(finalDate)) {
        return [finalDate, ...prev].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      }
      return prev;
    });
  };

  const loadChat = (dateKey: string): UIMessage[] => {
    const key = `myscheduler_chat_${context}_${dateKey}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  };

  return { chatDates, saveChat, loadChat, refreshDates: loadDates };
}
