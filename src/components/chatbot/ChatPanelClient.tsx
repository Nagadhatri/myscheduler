"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { MessageCircle, X, Send, Bot, Sparkles, Trash2, Mic, MicOff, Volume2, VolumeX, Settings, Calendar, Play } from "lucide-react";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { ChatErrorBoundary } from "./ChatErrorBoundary";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ReportChart, SlotCard, PendingActionCard } from "./GenerativeUI";

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
  const [pendingCall, setPendingCall] = useState<{ toolCallId: string, name: string; args: any } | null>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-3.1-flash-lite");
  const [voiceLang, setVoiceLang] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  
  const voiceConversationRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  // Load custom API settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      setGeminiApiKey(localStorage.getItem("gemini_api_key") || "");
      setGeminiModel(localStorage.getItem("gemini_model") || "gemini-3.1-flash-lite");
      setVoiceLang(localStorage.getItem("voice_lang") || "");
    }
  }, []);

  const [input, setInput] = useState("");
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInput(e.target.value);
  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim()) return;
    
    sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] });
    setInput("");
  };

  const { messages, sendMessage, status, addToolResult, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        context,
        urlPath: pathname,
        clientData: { targetUserId }
      },
      headers: {
        "x-gemini-api-key": geminiApiKey,
        "x-gemini-model": geminiModel
      }
    }),
    onFinish: (message: any) => {
       const text = message.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || '';
       if (voiceEnabled && text) {
         speakText(text);
       }
    },
    onError: (error) => {
      console.error("AI SDK Error:", error);
      toast.error("AI Engine Offline: Please check your API key in settings or .env.local");
      setMessages((prev: any) => [...prev, { 
        id: Date.now().toString(),
        role: 'model', 
        content: "⚠️ **The AI Engine failed to respond.**\n\nThis is usually because your API Key is invalid, deleted, or missing.\n\n**To Fix:**\n1. **Option 1 (Gemini):** Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).\n2. **Option 2 (Groq - Recommended):** Get a free, faster key from [Groq Console](https://console.groq.com/keys).\n3. Click the ⚙️ Settings icon in this chat window and paste your new key.\n\n*(Note: If you add it to the Vercel dashboard as `GROQ_API_KEY` or `GEMINI_API_KEY`, you won't ever need to enter it here again!)*",
        parts: [{ type: 'text', text: "⚠️ **The AI Engine failed to respond.**\n\nThis is usually because your API Key is invalid, deleted, or missing.\n\n**To Fix:**\n1. **Option 1 (Gemini):** Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).\n2. **Option 2 (Groq - Recommended):** Get a free, faster key from [Groq Console](https://console.groq.com/keys).\n3. Click the ⚙️ Settings icon in this chat window and paste your new key.\n\n*(Note: If you add it to the Vercel dashboard as `GROQ_API_KEY` or `GEMINI_API_KEY`, you won't ever need to enter it here again!)*" }]
      }]);
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Client-side tool execution
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    // Action-Tag Architecture Check
    const content = (lastMessage as any).content;
    if (content) {
      const actionMatch = content.match(/<ACTION>navigate:(.+?)<\/ACTION>/);
      if (actionMatch && actionMatch[1]) {
        router.push(actionMatch[1]);
      }
    }

    const toolParts = lastMessage.parts?.filter((p: any) => p.type.startsWith('tool-') || p.type === 'dynamic-tool') || [];
    
    if (toolParts.length > 0) {
      for (const toolInvocation of toolParts as any[]) {
        const toolName = toolInvocation.type === 'dynamic-tool' ? toolInvocation.toolName : toolInvocation.type.replace('tool-', '');
        if (toolInvocation.state !== 'result' && !toolInvocation.output) {
           // It's a pending tool call. Check if it's safe to auto-execute.
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
          
          if (safeActions.includes(toolName)) {
            // Auto execute
            executeTool(toolInvocation.toolCallId, toolName, toolInvocation.args || toolInvocation.input);
          } else {
            // Wait for user confirmation
            // Prevent duplicate pending calls
            if (pendingCall?.toolCallId !== toolInvocation.toolCallId) {
                setPendingCall({
                  toolCallId: toolInvocation.toolCallId,
                  name: toolName,
                  args: toolInvocation.args || toolInvocation.input
                });
            }
          }
        }
      }
    }
  }, [messages]);

  const executeTool = async (toolCallId: string, name: string, args: any) => {
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
          const { data } = await supabase.from("profiles").select("id, display_name, email, occupation").eq("id", user.id).single();
          responseObj = { user: data || null };
        }
      } else if (name === "getPageOwner") {
        if (!targetUserId) {
          responseObj = { error: "No target user ID provided for this page." };
        } else {
          const { data } = await supabase.from("profiles").select("id, display_name, email, occupation").eq("id", targetUserId).single();
          responseObj = { owner: data || null };
        }
      } else if (name === "getTodaySchedule") {
        const queryDate = args.date || format(new Date(), "yyyy-MM-dd");
        const { data } = await supabase.from("schedules").select("*").eq("date", queryDate);
        responseObj = { schedules: data || [] };
      } else if (name === "getAvailableSlots") {
        const ownerId = targetUserId || args.owner_id;
        if (!ownerId) throw new Error("No target user ID provided for checking slots.");
        const res = await fetch(`/api/available-slots?userId=${ownerId}&date=${args.date}`);
        const resData = await res.json();
        if (resData.error) throw new Error(resData.error);
        responseObj = { available_slots: resData.available_slots || [], date: args.date };
      } else if (name === "checkBookingStatus") {
        const { data } = await supabase.from("bookings").select("*, schedule:schedules(title, date, start_time, end_time)").eq("visitor_email", args.email);
        responseObj = { bookings: data || [] };
      } else if (name === "queryBookings") {
        const statusFilter = args.status || "Pending";
        let query = supabase.from("bookings").select("*, schedule:schedules(*)");
        if (statusFilter !== "all") query = query.eq("booking_status", statusFilter);
        const { data } = await query;
        responseObj = { bookings: data || [] };
      } else if (name === "searchPeople") {
         if (args.query) {
          const res = await fetch(`/api/search-people?query=${encodeURIComponent(args.query)}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          responseObj = { users: data.users || [] };
        } else {
          responseObj = { error: "General suggestions not available in this mode" };
        }
      } else if (name === "getConnections") {
        let query = supabase.from("connections").select("*, requester:profiles!connections_requester_id_fkey(id, display_name, email, occupation), receiver:profiles!connections_receiver_id_fkey(id, display_name, email, occupation)");
        if (args.status) query = query.eq("status", args.status);
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
        const { error } = await supabase.from("schedules").delete().eq("id", args.id);
        if (error) throw error;
        responseObj = { success: true, message: "Slot deleted." };
      } else if (name === "bookAppointment") {
        const targetId = targetUserId || args.owner_id;
        if (!targetId) throw new Error("No target user specified for booking.");
        const res = await fetch("/api/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: targetId, date: args.date, startTime: args.start_time, endTime: args.end_time,
            name: args.name, email: args.email, description: args.description,
          }),
        });
        const resData = await res.json();
        if (resData.error) throw new Error(resData.error);
        responseObj = { success: true, message: "Booking request submitted successfully!" };
      } else if (name === "sendConnectionRequest") {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");
        const { error } = await supabase.from("connections").insert({ requester_id: userData.user.id, receiver_id: args.receiver_id });
        if (error) throw error;
        responseObj = { success: true, message: "Connection request sent!" };
      } else if (name === "rescheduleSlot") {
        const res = await fetch("/api/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: args.slot_id, newDate: args.new_date, newStartTime: args.new_start_time, newEndTime: args.new_end_time,
            reason: args.reason || "Rescheduled by owner via AI Assistant.",
          }),
        });
        const resData = await res.json();
        if (resData.error) throw new Error(resData.error);
        responseObj = { success: true, message: resData.message || "Slot rescheduled successfully!" };
      } else if (name === "respondToBooking") {
        const { error } = await supabase.from("bookings").update({ booking_status: args.action, remarks: args.remarks }).eq("id", args.booking_id);
        if (error) throw error;
        responseObj = { success: true, message: `Booking marked as ${args.action}` };
      } else if (name === "requestPasswordReset") {
        const resetRedirect = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(args.email, { redirectTo: resetRedirect });
        if (error) throw error;
        responseObj = { success: true, message: `Password reset link has been sent to ${args.email}.` };
      } else if (name === "generateReport") {
        // Return dummy payload for the chart to render properly
        responseObj = { success: true, message: "Report generated.", data: [] };
      }
    } catch (err: any) {
      responseObj = { success: false, error: err.message };
    }

    // Add tool result to trigger next step
    addToolResult({ toolCallId, tool: name as any, output: responseObj });
  };

  const confirmCall = async (confirmed: boolean) => {
    if (!pendingCall) return;
    const call = pendingCall;
    setPendingCall(null);

    if (!confirmed) {
      addToolResult({ toolCallId: call.toolCallId, tool: call.name as any, output: { success: false, error: "User cancelled action." } });
      return;
    }
    await executeTool(call.toolCallId, call.name, call.args);
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pendingCall, isLoading]);

  // Voice Toggle Logic
  const handleMicToggle = () => {
    if (isListening) {
      window.speechSynthesis?.cancel();
      setIsListening(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Speech recognition is not supported. Use Chrome or Edge.");
        return;
      }

      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setIsListening(true);

      const recognition = new SpeechRecognition();
      recognition.lang = voiceLang || navigator.language || "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      let finalTranscript = "";

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setInput(finalTranscript + interimTranscript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/\*\*([^\*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}•]/gu, '').replace(/#+\s/g, '').replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();
    if (!cleanText || cleanText.length < 2) return;
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const clearChat = () => {
    setMessages([]);
    setPendingCall(null);
  };

  return (
    <>
      {mode === "floating" && !isOpen && (
        <button type="button" aria-label="Open Chat" onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl animate-pulse-glow cursor-pointer transition-transform hover:scale-110">
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </button>
      )}

      {(isOpen || mode === "inline") && (
        <div className={mode === "floating" ? "fixed bottom-6 right-6 w-80 md:w-96 h-[560px] flex flex-col z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-card/95 backdrop-blur-xl" : "w-full flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-card/50 backdrop-blur-md h-[600px]"}>
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Copilot</p>
                <p className="text-[10px] text-white/70">Agentic Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer" onClick={() => { window.speechSynthesis?.cancel(); setIsSpeaking(false); setVoiceEnabled(!voiceEnabled); }} title={voiceEnabled ? "Mute Bot Voice" : "Unmute Bot Voice"}>
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-white/50" />}
              </button>
              <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer" onClick={() => setShowSettings(true)} title="API Settings">
                <Settings className="w-4 h-4 text-white" />
              </button>
              <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer" onClick={clearChat} title="Clear chat">
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              {mode === "floating" && (
                <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
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
                  <button type="button" onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">API Key (Gemini or Groq)</label>
                    <Input type="password" placeholder="AIza... or gsk_..." value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} className="bg-background" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Voice Language</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)}>
                      <option value="">Browser Default</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Spanish</option>
                      <option value="te-IN">Telugu</option>
                    </select>
                  </div>
                  <Button type="button" className="w-full" onClick={() => { localStorage.setItem('gemini_api_key', geminiApiKey); localStorage.setItem('voice_lang', voiceLang); setShowSettings(false); toast.success("AI Settings saved!"); }}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0 px-4 py-3">
             {messages.length === 0 && (
              <div className="text-center py-10 px-4 space-y-4">
                <Bot className="w-10 h-10 mx-auto text-primary/30" />
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {context === "visitor" ? 'Ask me to book a slot!\nTry: "Book a meeting tomorrow at 10 AM"' : 'Ask me about your schedule!\nTry: "What\'s on my calendar today?"'}
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const displayText = (msg as any).content?.replace(/<ACTION>.*?<\/ACTION>/g, '').trim();
              const toolInvocations = (msg as any).parts?.filter((p: any) => p.type.startsWith('tool-') || p.type === 'dynamic-tool').map((p: any) => ({
                toolName: p.type === 'dynamic-tool' ? p.toolName : p.type.replace('tool-', ''),
                toolCallId: p.toolCallId,
                state: p.state,
                result: p.output,
                args: p.args || p.input
              })) || [];
              
              if (!displayText && toolInvocations.length === 0) return null;

              return (
              <div key={msg.id} className={`flex flex-col gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2`}>
                 <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    
                    {displayText && (
                      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${isUser ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm shadow-indigo-500/20" : "bg-slate-800/80 backdrop-blur-md border border-white/10 text-slate-100 rounded-bl-sm"}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          a: ({node, ...props}) => <a className="text-blue-400 hover:underline" target="_blank" {...props} />
                        }}>{displayText}</ReactMarkdown>
                      </div>
                    )}
                 </div>

                 {/* Render Generative UI for tool invocations */}
                 {toolInvocations.map((toolInvocation: any) => {
                    const { toolName, toolCallId, state } = toolInvocation;
                    
                    if (state === 'result' || toolInvocation.result) {
                      if (toolName === 'generateReport') {
                         return <div key={toolCallId} className="ml-10 max-w-[90%]"><ReportChart data={toolInvocation.result} /></div>;
                      }
                      if (toolName === 'getTodaySchedule' && toolInvocation.result?.schedules) {
                         return <div key={toolCallId} className="ml-10 flex flex-col gap-1 max-w-[80%]">
                            {toolInvocation.result.schedules.map((s: any) => <SlotCard key={s.id} {...s} />)}
                         </div>;
                      }
                      if (toolName === 'addSlot' || toolName === 'deleteSlot' || toolName === 'rescheduleSlot') {
                         return <div key={toolCallId} className="ml-10"><PendingActionCard message={toolInvocation.result?.message} /></div>;
                      }
                    } else if (state === 'call' && pendingCall?.toolCallId === toolCallId) {
                      return (
                         <div key={toolCallId} className="flex mb-3 justify-start ml-10">
                          <div className="max-w-[100%] px-3.5 py-3 rounded-2xl rounded-bl-md bg-primary/5 border border-primary/20 space-y-2 text-sm">
                            <p className="font-semibold text-primary text-xs">Confirm Action: {toolName}</p>
                            <div className="flex gap-2 pt-1">
                              <Button type="button" size="sm" className="h-7 text-xs glow-primary" onClick={() => confirmCall(true)}>Confirm</Button>
                              <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-white/10" onClick={() => confirmCall(false)}>Cancel</Button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                 })}
              </div>
            )})}
            
            {isLoading && !pendingCall && (
              <div className="flex items-end gap-2 mb-4 justify-start ml-2">
                <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="px-4 py-3.5 rounded-2xl rounded-bl-sm bg-slate-800/80 backdrop-blur-md border border-white/10 shadow-md">
                  <div className="flex gap-1.5 items-center h-full">
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={scrollRef} />
          </ScrollArea>

          {/* Auto-Prompts Chips */}
          <div className="px-3 pb-2 pt-1 flex gap-2 overflow-x-auto scrollbar-none">
             {context === 'owner' ? (
                <>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px] shrink-0" onClick={() => sendMessage({role: 'user', parts: [{type: 'text', text: 'What is my schedule today?'}]})}>📅 Today's Schedule</Button>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px] shrink-0" onClick={() => sendMessage({role: 'user', parts: [{type: 'text', text: 'Generate a report of my bookings'}]})}>📊 Generate Report</Button>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px] shrink-0" onClick={() => sendMessage({role: 'user', parts: [{type: 'text', text: 'Check pending bookings'}]})}>🔔 Pending Bookings</Button>
                </>
             ) : (
                <>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px] shrink-0" onClick={() => sendMessage({role: 'user', parts: [{type: 'text', text: 'What are the available slots tomorrow?'}]})}>🔍 Find Slots</Button>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px] shrink-0" onClick={() => sendMessage({role: 'user', parts: [{type: 'text', text: 'Who is the owner of this page?'}]})}>👤 About Owner</Button>
                </>
             )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-white/5 bg-card flex flex-col gap-2">
            <form onSubmit={handleSubmit} className="flex gap-2 relative">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder={isListening ? "🎤 Listening..." : "Message Copilot..."}
                disabled={isLoading || !!pendingCall}
                className="bg-white/5 border-white/5 text-sm"
              />
              <button
                type="button"
                onClick={handleMicToggle}
                className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors ${
                  isListening ? "bg-red-500 hover:bg-red-600 animate-pulse text-white" : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <Button type="submit" size="icon" disabled={!input.trim() || isLoading || !!pendingCall} className="glow-primary flex-shrink-0">
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
