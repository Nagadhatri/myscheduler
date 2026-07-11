"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { MessageCircle, X, Send, Bot, Sparkles, Trash2, Mic, MicOff, Volume2, VolumeX, Globe, User, Settings } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChatErrorBoundary } from "./ChatErrorBoundary";
import { useChatHistory } from "./useChatHistory";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

type Role = "user" | "model" | "function";
export type Message = {
  role: Role;
  text?: string;
  functionCall?: { name: string; args: any };
  thoughtSignature?: string;
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
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");

  const [ws, setWs] = useState<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceConversationRef = useRef(false);

  
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();
  
  const { saveChat, loadChat } = useChatHistory(context);
  
  // Load browser TTS voices
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (selectedChatDate) {
      setMessages(loadChat(selectedChatDate));
    } else {
      const today = format(new Date(), "yyyy-MM-dd");
      setMessages(loadChat(today));
    }

    // Load custom API settings
    if (typeof window !== "undefined") {
      setGeminiApiKey(localStorage.getItem('gemini_api_key') || '');
      setGeminiModel(localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite');
    }
  }, [selectedChatDate, context]);

  // Save chat history whenever messages change (only if there are messages)
  useEffect(() => {
    if (messages.length > 0) {
      saveChat(messages, selectedChatDate || undefined);
    }
  }, [messages, selectedChatDate]);

  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean text for natural speech output
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}•]/gu, '')
      .replace(/#+\s/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText || cleanText.length < 2) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Pick the best available English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find(v => v.name.includes('Microsoft Zira')) ||
      voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang.startsWith('en-'));
    if (preferred) utterance.voice = preferred;

    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Continuous conversation: auto-listen after bot finishes speaking
      if (voiceConversationRef.current && voiceEnabled) {
        setTimeout(() => {
          if (voiceConversationRef.current) handleRecordingStart();
        }, 400);
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
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
      toast.error("Speech recognition is not supported. Use Chrome or Edge.");
      return;
    }

    // Barge-in: stop bot mid-speech if it's talking
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    // Mark that user is in voice conversation mode
    voiceConversationRef.current = true;

    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    let silenceTimer: NodeJS.Timeout;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // We use a function state update to append to whatever is already there if needed, 
      // but for simplicity with continuous, we can just build the whole string.
      // Actually, since we only want one utterance per message, let's just use the current event's full text.
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      
      setInput(fullTranscript);

      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (fullTranscript.trim()) {
          recognition.stop();
          setInput("");
          sendMessage(fullTranscript.trim());
        }
      }, 1500); // 1.5 seconds of silence triggers send
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      if (event.error === "no-speech") {
        // Just ignore no-speech, it will timeout eventually or user can stop
      } else if (event.error === "not-allowed") {
        toast.error("Mic access denied. Allow it in browser settings.");
        setIsListening(false);
      } else if (event.error !== "aborted") {
        toast.error("Voice error. Please try again.");
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      clearTimeout(silenceTimer);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleRecordingStop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    // Barge-in: also stop bot speech
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    // Exit continuous voice conversation mode
    voiceConversationRef.current = false;
    setIsListening(false);
    setInput("");
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
      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (geminiApiKey) reqHeaders["x-gemini-api-key"] = geminiApiKey;
      if (geminiModel) reqHeaders["x-gemini-model"] = geminiModel;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: reqHeaders,
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
            thoughtSignature: data.thoughtSignature,
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
            thoughtSignature: data.thoughtSignature,
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
          
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hour12: false
          });
          
          const parts = formatter.formatToParts(new Date());
          let yyyy, mm, dd, hh;
          for (const part of parts) {
            if (part.type === 'year') yyyy = part.value;
            if (part.type === 'month') mm = part.value;
            if (part.type === 'day') dd = part.value;
            if (part.type === 'hour') hh = part.value;
          }
          const todayDate = `${yyyy}-${mm}-${dd}`;
          const currentHour = hh === '24' ? 0 : parseInt(hh || '0', 10);
          const isToday = args.date === todayDate;

          for (let h = 5; h < 23; h++) {
            if (h === 12) continue;
            if (isToday && h <= currentHour) continue;

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
        const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (geminiApiKey) reqHeaders["x-gemini-api-key"] = geminiApiKey;
        if (geminiModel) reqHeaders["x-gemini-model"] = geminiModel;

        const res = await fetch("/api/reports", {
          method: "POST",
          headers: reqHeaders,
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
          type="button"
          aria-label="Open Chat"
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
                  window.speechSynthesis?.cancel();
                  setIsSpeaking(false);
                  voiceConversationRef.current = false;
                  setVoiceEnabled(!voiceEnabled);
                }}
                title={voiceEnabled ? "Mute Bot Voice" : "Unmute Bot Voice"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-white/50" />}
              </button>
              <button
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => setShowSettings(true)}
                title="API Settings"
              >
                <Settings className="w-4 h-4 text-white" />
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

          {showSettings && (
            <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-xl shadow-2xl border border-white/10 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <h3 className="font-semibold text-sm">AI Engine Settings</h3>
                  <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Gemini API Key</label>
                    <Input
                      type="password"
                      placeholder="AI Studio API Key"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Gemini Model</label>
                    <Input
                      type="text"
                      placeholder="e.g. gemini-3.1-flash-lite"
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => {
                      localStorage.setItem('gemini_api_key', geminiApiKey);
                      localStorage.setItem('gemini_model', geminiModel);
                      setShowSettings(false);
                      toast.success("AI Settings saved!");
                    }}
                  >
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <ScrollArea className="flex-1 min-h-0 px-4 py-3">
            {messages.length === 0 && (
              <div className="text-center py-10 px-4 space-y-4">
                <Bot className="w-10 h-10 mx-auto text-primary/30" />
                {!geminiApiKey ? (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-primary">API Key Required</p>
                    <p className="text-xs text-muted-foreground">To use the AI Assistant, please set up your Gemini API Key first.</p>
                    <Button size="sm" onClick={() => setShowSettings(true)} className="w-full text-xs">Set API Key</Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {context === "visitor"
                      ? 'Ask me to book a slot!\nTry: "Book a meeting tomorrow at 10 AM"'
                      : 'Ask me about your schedule!\nTry: "What\'s on my calendar today?"'}
                  </p>
                )}
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
                  className={`flex items-end gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role !== "user" && (
                    <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm shadow-indigo-500/20"
                        : "bg-slate-800/80 backdrop-blur-md border border-white/10 text-slate-100 rounded-bl-sm"
                    }`}
                  >
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus as any}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-md my-2"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className="bg-white/10 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                              {children}
                            </code>
                          );
                        },
                        a({ node, className, href, children, ...props }: any) {
                          if (href?.startsWith("/")) {
                            return (
                              <span
                                onClick={() => router.push(href)}
                                className="text-primary hover:underline font-semibold cursor-pointer underline decoration-primary/50"
                              >
                                {children}
                              </span>
                            );
                          }
                          return (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-semibold underline decoration-primary/50"
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        },
                        table({ node, ...props }: any) {
                          return (
                            <div className="overflow-x-auto my-2">
                              <table className="w-full text-left border-collapse border border-white/10 text-xs" {...props} />
                            </div>
                          );
                        },
                        th({ node, ...props }: any) {
                          return <th className="border border-white/10 bg-white/5 p-2 font-semibold" {...props} />;
                        },
                        td({ node, ...props }: any) {
                          return <td className="border border-white/10 p-2" {...props} />;
                        },
                        p({ node, ...props }: any) {
                          return <p className="mb-2 last:mb-0" {...props} />;
                        },
                        ul({ node, ...props }: any) {
                          return <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1" {...props} />;
                        },
                        ol({ node, ...props }: any) {
                          return <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1" {...props} />;
                        }
                      }}
                    >
                      {msg.text || ""}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 shrink-0 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
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
              <div className="flex items-end gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 justify-start">
                <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="px-4 py-3.5 rounded-2xl rounded-bl-sm bg-slate-800/80 backdrop-blur-md border border-white/10 shadow-md">
                  <div className="flex gap-1.5 items-center h-full">
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
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
                  !geminiApiKey ? "Please set your Gemini API Key first..." :
                  isListening ? "🎤 Speak now..." :
                  isTranscribing ? "Processing your speech..." :
                  context === "visitor"
                    ? "Book a slot, check status..."
                    : "Manage schedule, view bookings..."
                }
                disabled={!geminiApiKey || loading || !!pendingCall || isListening || isTranscribing}
                className="bg-white/5 border-white/5 text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Toggle microphone"
                className={`flex-shrink-0 border-white/10 transition-all duration-200 ${isListening ? "bg-red-500/20 text-red-500 border-red-500/50 animate-pulse shadow-lg shadow-red-500/20" : isTranscribing ? "bg-primary/20 text-primary border-primary/50" : ""}`}
                onClick={toggleListening}
                disabled={!geminiApiKey || loading || !!pendingCall || isTranscribing}
                title={isListening ? "Stop listening" : "Speak (Microphone)"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={!geminiApiKey || !input.trim() || loading || !!pendingCall || isListening || isTranscribing}
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
