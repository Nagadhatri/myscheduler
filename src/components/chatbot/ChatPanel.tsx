"use client";

import dynamic from "next/dynamic";

const ChatPanelClient = dynamic(() => import("./ChatPanelClient"), { ssr: false });

export default function ChatPanel(props: any) {
  return <ChatPanelClient {...props} />;
}
