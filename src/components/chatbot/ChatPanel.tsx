"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { toast } from "sonner";

type Role = 'user' | 'model' | 'function';
type Message = {
  role: Role;
  text?: string;
  functionCall?: { name: string; args: any };
  name?: string; // for function response
  response?: any; // for function response
};

export default function ChatPanel({ context }: { context: "owner" | "visitor" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCall, setPendingCall] = useState<{name: string, args: any} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pendingCall]);

  const sendMessage = async (newInput: string, currentHistory: Message[] = messages) => {
    if (!newInput.trim() && !pendingCall && currentHistory[currentHistory.length-1]?.role !== 'function') return;

    let historyToPass = [...currentHistory];
    
    if (newInput) {
      historyToPass.push({ role: "user", text: newInput });
      setMessages(historyToPass);
      setInput("");
    }

    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyToPass.slice(0, -1),
          message: historyToPass[historyToPass.length - 1].text || "",
          context
        })
      });

      const data = await res.json();
      
      if (data.type === "text") {
        setMessages(prev => [...prev, { role: "model", text: data.text }]);
      } else if (data.type === "function_call") {
        const call = data.functionCall;
        setMessages(prev => [...prev, { role: "model", functionCall: call }]);
        
        // Handle auto-reads
        if (["getTodaySchedule", "getAvailableSlots", "queryBookings", "checkBookingStatus"].includes(call.name)) {
          await handleFunctionExecution(call.name, call.args, [...historyToPass, { role: "model", functionCall: call }]);
        } else {
          // Write operation needs confirmation
          setPendingCall(call);
        }
      }
    } catch (err: any) {
      toast.error("Chat error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFunctionExecution = async (name: string, args: any, currentHistory: Message[]) => {
    let responseObj: any = {};
    
    try {
      if (name === "getTodaySchedule") {
        const today = format(new Date(), "yyyy-MM-dd");
        const { data } = await supabase.from('schedules').select('*').eq('date', today);
        responseObj = { schedules: data };
      } else if (name === "getAvailableSlots") {
        const { data } = await supabase.from('schedules').select('*, bookings(booking_status)').eq('date', args.date).eq('status', 'Upcoming');
        const available = data?.filter((s: any) => !s.bookings?.some((b: any) => b.booking_status === 'Accepted'));
        responseObj = { available_slots: available };
      } else if (name === "checkBookingStatus") {
        const { data } = await supabase.from('bookings').select('*, schedule:schedules(title, date, start_time, end_time)').eq('visitor_email', args.email);
        responseObj = { bookings: data };
      } else if (name === "queryBookings") {
        const { data } = await supabase.from('bookings').select('*, schedule:schedules(*)').eq('booking_status', 'Pending');
        responseObj = { pending_bookings: data };
      } else if (name === "addSlot") {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");
        const { error } = await supabase.from('schedules').insert({
          title: args.title, date: args.date, start_time: args.start_time, end_time: args.end_time, category: args.category, owner_id: userData.user.id
        });
        if (error) throw error;
        responseObj = { success: true, message: "Slot added." };
      } else if (name === "deleteSlot") {
        const { error } = await supabase.from('schedules').delete().eq('id', args.id);
        if (error) throw error;
        responseObj = { success: true, message: "Slot deleted." };
      } else if (name === "bookAppointment") {
        const { error } = await supabase.from('bookings').insert({
          schedule_id: args.schedule_id, visitor_name: args.name, visitor_email: args.email, description: args.description, booking_status: 'Pending'
        });
        if (error) throw error;
        responseObj = { success: true, message: "Booking requested." };
      }
    } catch (err: any) {
      responseObj = { success: false, error: err.message };
    }

    const funcMsg: Message = { role: "function", name, response: responseObj };
    const newHistory = [...currentHistory, funcMsg];
    setMessages(newHistory);
    
    // Automatically send function response back to LLM to get final text
    sendMessage("", newHistory);
  };

  const confirmCall = async (confirmed: boolean) => {
    if (!pendingCall) return;
    const call = pendingCall;
    setPendingCall(null);

    if (!confirmed) {
      const funcMsg: Message = { role: "function", name: call.name, response: { success: false, error: "User cancelled the operation." } };
      const newHistory = [...messages, funcMsg];
      setMessages(newHistory);
      sendMessage("", newHistory);
      return;
    }

    await handleFunctionExecution(call.name, call.args, messages);
  };

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg flex items-center justify-center z-50"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-80 md:w-96 h-[500px] flex flex-col shadow-2xl z-50 border-primary/20">
          <CardHeader className="bg-primary text-primary-foreground py-3 flex flex-row items-center justify-between rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-5 h-5" />
              AI Assistant
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-primary/80" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4 bg-muted/10">
              {messages.map((msg, i) => {
                if (msg.role === 'function') return null; // Hide raw function responses
                if (msg.role === 'model' && msg.functionCall && msg.functionCall.name !== pendingCall?.name) {
                  return null; // Hide executed tool calls
                }
                
                return (
                  <div key={i} className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              
              {pendingCall && (
                <div className="flex mb-4 justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg text-sm bg-card border border-primary rounded-tl-none space-y-2">
                    <p className="font-semibold text-primary">Confirmation Required</p>
                    <p>The AI wants to execute: <strong>{pendingCall.name}</strong></p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(pendingCall.args, null, 2)}</pre>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => confirmCall(true)}>Confirm</Button>
                      <Button size="sm" variant="outline" onClick={() => confirmCall(false)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              )}

              {loading && !pendingCall && (
                <div className="flex mb-4 justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg text-sm bg-card border rounded-tl-none italic text-muted-foreground">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </ScrollArea>
            <div className="p-3 border-t bg-card">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={loading || !!pendingCall}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || loading || !!pendingCall}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
