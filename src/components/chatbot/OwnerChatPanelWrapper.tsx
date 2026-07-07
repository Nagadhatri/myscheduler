"use client";

import { useDashboard } from "@/components/owner/DashboardContext";
import ChatPanel from "./ChatPanel";

export default function OwnerChatPanelWrapper() {
  const { selectedChatDate } = useDashboard();
  return (
    <div className="h-[600px]">
      <ChatPanel context="owner" mode="inline" selectedChatDate={selectedChatDate} />
    </div>
  );
}
