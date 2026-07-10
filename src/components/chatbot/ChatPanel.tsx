"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { MessageCircle, X, Send, Bot, Sparkles, Trash2, Mic, MicOff, Volume2, VolumeX, Globe } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChatErrorBoundary } from "./ChatErrorBoundary";
import { useChatHistory } from "./useChatHistory";

type Role = "user" | "model" | "function";
export type Message = {
  role: Role;
  text?: string;
  functionCall?: { name: string; args: any };
  name?: string;
  response?: any;
};

function ChatPanelInner({
  context,
  targetUserId,
  mode = "floating",
  selectedChatDate,
}: {
  context: "owner" | "visitor";
  targetUserId?: string;
  mode?: "floating" | "inline";
  selectedChatDate?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCall, setPendingCall] = useState<{
    name: string;
    args: any;
  } | null>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();
  
  const { saveChat, loadChat } = useChatHistory(context);
  
  useEffect(() => {
    if (selectedChatDate) {
      setMessages(loadChat(selectedChatDate));
    } else {
      // Default to today if not provided, or clear if forced
      const today = format(new Date(), "yyyy-MM-dd");
      setMessages(loadChat(today));
    }

    // Connect to Local Vosk + Rasa WebSocket server
    const socket = new WebSocket("ws://localhost:2700");
    
    socket.onopen = () => {
      console.log("Connected to local AI voice server");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "stt") {
          // Received parsed text from speech
          setMessages(prev => [...prev, { role: "user", text: data.text }]);
        } else if (data.type === "bot") {
          setMessages(prev => [...prev, { role: "model", text: data.text }]);
          // Note: pyttsx3 on backend speaks it automatically
        } else if (data.type === "partial") {
          // Could show a typing indicator or partial text
        }
      } catch (err) {
        console.error(err);
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [selectedChatDate, context]);

  // Save chat history whenever messages change (only if there are messages)
  useEffect(() => {
    if (messages.length > 0) {
      saveChat(messages, selectedChatDate || undefined);
    }
  }, [messages, selectedChatDate]);

  const speakText = (text: string) => {
    // Disabled browser TTS. We are using local pyttsx3 via vosk_server.py
    // to provide a better, native-sounding voice.
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const toggleListening = () => {
    if (isListening) {
      handleRecordingStop();
    } else {
      handleRecordingStart();
    }
  };

  const handleRecordingStart = async () => {
    if (isListening) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in your browser. Please use Chrome/Edge.");
      return;
    }
    
    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        // Set as input text so user sees what they said, then auto-submit
        setInput(transcript);
        // Use a small delay to let React update the input state before submitting
        setTimeout(() => {
          setIsListening(false);
          // Directly call sendMessage with the transcript
          sendMessage(transcript);
          setInput("");
        }, 100);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === "no-speech") {
        toast.error("No speech detected. Please try again.");
      } else if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please allow microphone in your browser.");
      }
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleRecordingStop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Regex to match markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const renderBoldText = (subText: string, baseKey: string) => {
      const boldRegex = /\*\*([^*]+)\*\*/g;
      const subParts: React.ReactNode[] = [];
      let subLastIndex = 0;
      let subMatch;

      while ((subMatch = boldRegex.exec(subText)) !== null) {
        const plainText = subText.substring(subLastIndex, subMatch.index);
        if (plainText) {
          subParts.push(plainText);
        }
        subParts.push(
          <strong key={`${baseKey}-bold-${subMatch.index}`} className="font-bold text-foreground">
            {subMatch[1]}
          </strong>
        );
        subLastIndex = boldRegex.lastIndex;
      }

      const remaining = subText.substring(subLastIndex);
      if (remaining) {
        subParts.push(remaining);
      }

      return subParts;
    };

    while ((match = linkRegex.exec(text)) !== null) {
      const plainText = text.substring(lastIndex, match.index);
      if (plainText) {
        parts.push(...renderBoldText(plainText, `plain-${lastIndex}`));
      }
      const label = match[1];
      const url = match[2];

      const key = `link-${match.index}`;
      if (url.startsWith("/")) {
        parts.push(
          <span
            key={key}
            onClick={() => {
              router.push(url);
            }}
            className="text-primary hover:underline font-semibold cursor-pointer underline decoration-primary/50"
          >
            {label}
          </span>
        );
      } else {
        parts.push(
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold underline decoration-primary/50"
          >
            {label}
          </a>
        );
      }
      lastIndex = linkRegex.lastIndex;
    }

    const remaining = text.substring(lastIndex);
    if (remaining) {
      parts.push(...renderBoldText(remaining, `plain-${lastIndex}`));
    }

    return parts;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pendingCall, loading]);

  const clearChat = () => {
    setMessages([]);
    setPendingCall(null);
  };

  const sendMessage = async (
    newInput: string,
    currentHistory: Message[] = messages
  ) => {
    if (!newInput.trim() && currentHistory[currentHistory.length - 1]?.role !== "function") return;

    let historyToPass = [...currentHistory];

    if (newInput) {
      historyToPass.push({ role: "user", text: newInput });
      setMessages(historyToPass);
      setInput("");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyToPass,
          message: newInput || undefined,
          context,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "model", text: `⚠️ ${data.error}` },
        ]);
      } else if (data.type === "function_call") {
        const fc = data.functionCall;
        // Auto-execute safe read-only functions immediately
        const safeActions = [
          "getTodaySchedule",
          "getAvailableSlots",
          "queryBookings",
          "checkBookingStatus",
          "searchPeople",
          "getCurrentUser",
          "getPageOwner",
          "getConnections",
          "navigateToPage",
          "generateReport",
          "getMeetingMinutes",
        ];
        if (safeActions.includes(fc.name)) {
          const modelMsg: Message = {
            role: "model",
            text: "",
            functionCall: fc,
          };
          const updatedHistory = [...historyToPass, modelMsg];
          setMessages(updatedHistory);
          await handleFunctionExecution(fc.name, fc.args, updatedHistory);
        } else {
          // Destructive action — ask user to confirm
          const modelMsg: Message = {
            role: "model",
            text: "",
            functionCall: fc,
          };
          setMessages((prev) => [...prev, modelMsg]);
          setPendingCall(fc);
        }
      } else {
        // Plain text response
        const botMsg: Message = { role: "model", text: data.text || "" };
        setMessages((prev) => [...prev, botMsg]);
        if (voiceEnabled && data.text) {
          speakText(data.text);
        }
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Sorry, something went wrong. Please try again!",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFunctionExecution = async (
    name: string,
    args: any,
    currentHistory: Message[]
  ) => {
    let responseObj: any = {};

    try {
      if (name === "navigateToPage") {
        router.push(args.path);
        responseObj = { success: true, message: `Successfully navigated to ${args.path}` };
      } else if (name === "getCurrentUser") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          responseObj = { error: "User not logged in." };
        } else {
          const { data } = await supabase
            .from("profiles")
            .select("id, display_name, email, occupation")
            .eq("id", user.id)
            .single();
          responseObj = { user: data || null };
        }
      } else if (name === "getPageOwner") {
        if (!targetUserId) {
          responseObj = { error: "No target user ID provided for this page." };
        } else {
          const { data } = await supabase
            .from("profiles")
            .select("id, display_name, email, occupation")
            .eq("id", targetUserId)
            .single();
          responseObj = { owner: data || null };
        }
      } else if (name === "getTodaySchedule") {
        const queryDate = args.date || format(new Date(), "yyyy-MM-dd");
        const { data } = await supabase
          .from("schedules")
          .select("*")
          .eq("date", queryDate);
        responseObj = { schedules: data || [] };
      } else if (name === "getAvailableSlots") {
        const ownerId = targetUserId || args.owner_id;
        if (!ownerId) throw new Error("No target user ID provided for checking slots.");
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Unauthenticated visitor -> fetch from public endpoint
          const res = await fetch(`/api/available-slots?userId=${ownerId}&date=${args.date}`);
          const resData = await res.json();
          if (resData.error) throw new Error(resData.error);
          
          // Map to match structure expected by LLM
          responseObj = { available_slots: resData.available_slots || [], date: args.date };
        } else {
          // Return the auto-generated slot info
          const { data } = await supabase
            .from("schedules")
            .select("*, bookings(booking_status)")
            .eq("owner_id", ownerId)
            .eq("date", args.date)
            .eq("status", "Upcoming");
          const booked = (data || [])
            .filter((s: any) =>
              s.bookings?.some((b: any) =>
                ["Accepted", "Accepted with Remarks", "Pending"].includes(b.booking_status)
              )
            )
            .map((s: any) => s.start_time);
          // Generate all slots and filter
          const allSlots = [];
          for (let h = 5; h < 23; h++) {
            const st = `${String(h).padStart(2, "0")}:00:00`;
            if (!booked.includes(st)) {
              allSlots.push({
                time: `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`,
                date: args.date,
                start_time: st,
              });
            }
          }
          responseObj = { available_slots: allSlots, date: args.date };
        }
      } else if (name === "checkBookingStatus") {
        const { data } = await supabase
          .from("bookings")
          .select("*, schedule:schedules(title, date, start_time, end_time)")
          .eq("visitor_email", args.email);
        responseObj = { bookings: data || [] };
      } else if (name === "queryBookings") {
        const statusFilter = args.status || "Pending";
        let query = supabase
          .from("bookings")
          .select("*, schedule:schedules(*)");
        if (statusFilter !== "all") {
          query = query.eq("booking_status", statusFilter);
        }
        const { data } = await query;
        responseObj = { bookings: data || [] };
      } else if (name === "searchPeople") {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (args.query) {
          const res = await fetch(`/api/search-people?query=${encodeURIComponent(args.query)}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          responseObj = { users: data.users || [] };
        } else {
          if (!user) throw new Error("Not authenticated");
          const { getPeopleYouMayKnow } = await import("@/lib/recommendations");
          const recommendations = await getPeopleYouMayKnow(supabase, user.id, user.email || "");
          responseObj = { 
            users: recommendations
              .filter(r => r.score > 0)
              .map(r => ({
                id: r.profile.id,
                display_name: r.profile.display_name,
                email: r.profile.email,
                occupation: r.profile.occupation,
                reasons: r.reasons,
              }))
          };
        }
      } else if (name === "getConnections") {
        let query = supabase.from("connections").select("*, requester:profiles!connections_requester_id_fkey(id, display_name, email, occupation), receiver:profiles!connections_receiver_id_fkey(id, display_name, email, occupation)");
        if (args.status) {
          query = query.eq("status", args.status);
        }
        const { data } = await query;
        responseObj = { connections: data || [] };
      } else if (name === "addSlot") {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");
        const { error } = await supabase.from("schedules").insert({
          title: args.title,
          date: args.date,
          start_time: args.start_time + ":00",
          end_time: args.end_time + ":00",
          category: args.category,
          owner_id: userData.user.id,
        });
        if (error) throw error;
        responseObj = { success: true, message: "Slot added successfully." };
      } else if (name === "deleteSlot") {
        const { error } = await supabase
          .from("schedules")
          .delete()
          .eq("id", args.id);
        if (error) throw error;
        responseObj = { success: true, message: "Slot deleted." };
      } else if (name === "bookAppointment") {
        const targetId = targetUserId || args.owner_id;
        if (!targetId) throw new Error("No target user specified for booking.");
        
        const res = await fetch("/api/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: targetId,
            date: args.date,
            startTime: args.start_time,
            endTime: args.end_time,
            name: args.name,
            email: args.email,
            description: args.description,
          }),
        });
        const resData = await res.json();
        if (resData.error) throw new Error(resData.error);
        responseObj = {
          success: true,
          message: "Booking request submitted successfully!",
        };
      } else if (name === "sendConnectionRequest") {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");
        const { error } = await supabase.from("connections").insert({
          requester_id: userData.user.id,
          receiver_id: args.receiver_id,
        });
        if (error) throw error;
        responseObj = { success: true, message: "Connection request sent!" };
      } else if (name === "rescheduleSlot") {
        const res = await fetch("/api/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: args.slot_id,
            newDate: args.new_date,
            newStartTime: args.new_start_time,
            newEndTime: args.new_end_time,
            reason: args.reason || "Rescheduled by owner via AI Assistant.",
          }),
        });
        const resData = await res.json();
        if (resData.error) throw new Error(resData.error);
        responseObj = {
          success: true,
          message: resData.message || "Slot rescheduled successfully!",
        };
      } else if (name === "respondToBooking") {
        const { error } = await supabase
          .from("bookings")
          .update({ booking_status: args.action, remarks: args.remarks })
          .eq("id", args.booking_id);
        if (error) throw error;
        responseObj = { success: true, message: `Booking marked as ${args.action}` };
      } else if (name === "requestPasswordReset") {
        const resetRedirect = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(args.email, {
          redirectTo: resetRedirect,
        });
        if (error) throw error;
        responseObj = { success: true, message: `Password reset link has been sent to ${args.email}.` };
      } else if (name === "generateReport") {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportType: args.reportType,
            dateFrom: args.dateFrom,
            dateTo: args.dateTo,
          }),
        });
        const resData = await res.json();
        if (resData.error) throw new Error(resData.error);
        responseObj = { success: true, report: resData.report.content };
      } else if (name === "getMeetingMinutes") {
        let url = "/api/meeting-minutes?";
        if (args.scheduleId) url += `scheduleId=${args.scheduleId}`;
        else if (args.date) url += `date=${args.date}`;
        
        const res = await fetch(url);
        const resData = await res.json();
        if (resData.error) throw new Error(resData.error);
        responseObj = { success: true, minutes: resData.minutes || null };
      }
    } catch (err: any) {
      responseObj = { success: false, error: err.message };
    }

    const funcMsg: Message = { role: "function", name, response: responseObj };
    const newHistory = [...currentHistory, funcMsg];
    setMessages(newHistory);

    // Send function response back to LLM
    sendMessage("", newHistory);
  };

  const confirmCall = async (confirmed: boolean) => {
    if (!pendingCall) return;
    const call = pendingCall;
    setPendingCall(null);

    if (!confirmed) {
      const funcMsg: Message = {
        role: "function",
        name: call.name,
        response: { success: false, error: "User cancelled." },
      };
      const newHistory = [...messages, funcMsg];
      setMessages(newHistory);
      sendMessage("", newHistory);
      return;
    }

    await handleFunctionExecution(call.name, call.args, messages);
  };

  return (
    <>
      {/* Floating button */}
      {mode === "floating" && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl animate-pulse-glow cursor-pointer transition-transform hover:scale-110"
        >
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </button>
      )}

      {/* Chat window */}
      {(isOpen || mode === "inline") && (
        <div 
          className={
            mode === "floating" 
              ? "fixed bottom-6 right-6 w-80 md:w-96 h-[520px] flex flex-col z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-card/95 backdrop-blur-xl"
              : "w-full flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-card/50 backdrop-blur-md h-[600px]"
          }
        >
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  AI Assistant
                </p>
                <p className="text-[10px] text-white/70">Smart Navigator</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => {
                  if (voiceEnabled) window.speechSynthesis?.cancel();
                  setVoiceEnabled(!voiceEnabled);
                }}
                title={voiceEnabled ? "Mute Bot Voice" : "Unmute Bot Voice"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-white/50" />}
              </button>
              <button
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                onClick={clearChat}
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              {mode === "floating" && (
                <button
                  className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <Bot className="w-10 h-10 mx-auto mb-3 text-primary/30" />
                <p className="text-sm text-muted-foreground">
                  {context === "visitor"
                    ? 'Ask me to book a slot!\nTry: "Book a meeting tomorrow at 10 AM"'
                    : 'Ask me about your schedule!\nTry: "What\'s on my calendar today?"'}
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              if (msg.role === "function") return null;
              if (
                msg.role === "model" &&
                msg.functionCall &&
                msg.functionCall.name !== pendingCall?.name
              )
                return null;

              return (
                <div
                  key={i}
                  className={`flex mb-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-white/5 border border-white/5 rounded-bl-md"
                    }`}
                  >
                    {renderFormattedText(msg.text || "")}
                  </div>
                </div>
              );
            })}

            {pendingCall && (
              <div className="flex mb-3 justify-start">
                <div className="max-w-[85%] px-3.5 py-3 rounded-2xl rounded-bl-md bg-primary/5 border border-primary/20 space-y-2 text-sm">
                  <p className="font-semibold text-primary text-xs">
                    Confirm Action
                  </p>
                  <p className="text-xs">
                    {pendingCall.name === "bookAppointment"
                      ? `Book slot for ${pendingCall.args.name} on ${pendingCall.args.date}`
                      : pendingCall.name === "addSlot"
                        ? `Add "${pendingCall.args.title}" on ${pendingCall.args.date}`
                      : pendingCall.name === "rescheduleSlot"
                        ? `Reschedule slot to ${pendingCall.args.new_date} at ${pendingCall.args.new_start_time}`
                      : pendingCall.name === "sendConnectionRequest"
                        ? `Send connection request to ${pendingCall.args.receiver_id}`
                      : pendingCall.name === "respondToBooking"
                        ? `Respond to booking: ${pendingCall.args.action}`
                        : pendingCall.name === "requestPasswordReset"
                          ? `Send a password reset link to ${pendingCall.args.email}`
                          : `Execute: ${pendingCall.name}`}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="h-7 text-xs glow-primary"
                      onClick={() => confirmCall(true)}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/10"
                      onClick={() => confirmCall(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {loading && !pendingCall && (
              <div className="flex mb-3 justify-start">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/5 border border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-white/5 bg-card flex flex-col gap-2">
            {/* Status indicators */}

            {isSpeaking && (
               <div className="flex items-center justify-end px-1">
                 <span className="text-[10px] text-primary animate-pulse">Bot is speaking...</span>
               </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isListening) {
                  handleRecordingStop();
                }
                sendMessage(input);
              }}
              className="flex gap-2 relative"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening ? "🎤 Speak now..." :
                  isTranscribing ? "Processing your speech..." :
                  context === "visitor"
                    ? "Book a slot, check status..."
                    : "Manage schedule, view bookings..."
                }
                disabled={loading || !!pendingCall || isListening || isTranscribing}
                className="bg-white/5 border-white/5 text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Toggle microphone"
                className={`flex-shrink-0 border-white/10 transition-all duration-200 ${isListening ? "bg-red-500/20 text-red-500 border-red-500/50 animate-pulse shadow-lg shadow-red-500/20" : isTranscribing ? "bg-primary/20 text-primary border-primary/50" : ""}`}
                onClick={toggleListening}
                disabled={loading || !!pendingCall || isTranscribing}
                title={isListening ? "Stop listening" : "Speak (Microphone)"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={!input.trim() || loading || !!pendingCall || isListening || isTranscribing}
                className="glow-primary flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function ChatPanel(props: {
  context: "owner" | "visitor";
  targetUserId?: string;
  mode?: "floating" | "inline";
  selectedChatDate?: string | null;
}) {
  return (
    <ChatErrorBoundary>
      <ChatPanelInner {...props} />
    </ChatErrorBoundary>
  );
}
