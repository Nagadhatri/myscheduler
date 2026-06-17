"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { MessageCircle, X, Send, Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Role = "user" | "model" | "function";
type Message = {
  role: Role;
  text?: string;
  functionCall?: { name: string; args: any };
  name?: string;
  response?: any;
};

export default function ChatPanel({
  context,
  targetUserId,
}: {
  context: "owner" | "visitor";
  targetUserId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCall, setPendingCall] = useState<{
    name: string;
    args: any;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pendingCall, loading]);

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
      const lastMsg = historyToPass[historyToPass.length - 1];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyToPass.slice(0, -1),
          message: lastMsg?.text || "",
          context,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "model", text: `⚠️ ${data.error}` },
        ]);
        setLoading(false);
        return;
      }

      if (data.type === "text") {
        setMessages((prev) => [...prev, { role: "model", text: data.text }]);
      } else if (data.type === "function_call") {
        const call = data.functionCall;
        setMessages((prev) => [
          ...prev,
          { role: "model", functionCall: call },
        ]);

        // Auto-execute read operations
        if (
          [
            "getTodaySchedule",
            "getAvailableSlots",
            "queryBookings",
            "checkBookingStatus",
            "searchPeople",
            "getConnections",
            "getCurrentUser",
            "getPageOwner",
            "navigateToPage",
          ].includes(call.name)
        ) {
          await handleFunctionExecution(call.name, call.args, [
            ...historyToPass,
            { role: "model", functionCall: call },
          ]);
        } else {
          // Write ops need confirmation
          setPendingCall(call);
        }
      }
    } catch (err: any) {
      toast.error("Chat error: " + err.message);
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
              ["Accepted", "Accepted with Remarks"].includes(b.booking_status)
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
        // Create schedule + booking
        const targetId = targetUserId || args.owner_id;
        if (!targetId) throw new Error("No target user specified for booking.");
        const { data: scheduleData, error: scheduleError } = await supabase
          .from("schedules")
          .insert({
            title: `Booking by ${args.name}`,
            category: "Meeting",
            date: args.date,
            start_time: args.start_time,
            end_time: args.end_time,
            status: "Upcoming",
            owner_id: targetId,
          })
          .select("id")
          .single();
        if (scheduleError) throw scheduleError;
        const { error: bookingError } = await supabase
          .from("bookings")
          .insert({
            schedule_id: scheduleData.id,
            visitor_name: args.name,
            visitor_email: args.email,
            description: args.description,
            booking_status: "Pending",
          });
        if (bookingError) throw bookingError;
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
        // 1. Fetch old slot to copy details and check for bookings
        const { data: oldSlot } = await supabase.from("schedules").select("*").eq("id", args.slot_id).single();
        if (!oldSlot) throw new Error("Slot not found.");

        const { data: booking } = await supabase
          .from("bookings")
          .select("*")
          .eq("schedule_id", args.slot_id)
          .maybeSingle();

        // 2. Update old slot to Rescheduled
        const { error: updateError } = await supabase
          .from("schedules")
          .update({ status: "Rescheduled" })
          .eq("id", args.slot_id);
        if (updateError) throw updateError;
        
        // 3. Insert new slot
        const { data: newSlot, error: insertError } = await supabase
          .from("schedules")
          .insert({
            title: oldSlot.title,
            category: oldSlot.category,
            description: oldSlot.description,
            date: args.new_date,
            start_time: args.new_start_time + ":00",
            end_time: args.new_end_time + ":00",
            owner_id: oldSlot.owner_id,
            status: "Upcoming",
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        let bookingMsg = "";
        if (booking && newSlot) {
          const { error: bookingError } = await supabase
            .from("bookings")
            .update({ schedule_id: newSlot.id, booking_status: "Rescheduled" })
            .eq("id", booking.id);
          if (bookingError) throw bookingError;
          bookingMsg = ` Affected booking for visitor ${booking.visitor_name} (${booking.visitor_email}) was moved to the new slot and marked as Rescheduled.`;
        }
        
        responseObj = { 
          success: true, 
          message: `Slot rescheduled successfully!${bookingMsg}`,
          visitor_name: booking?.visitor_name || null,
          visitor_email: booking?.visitor_email || null,
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
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl animate-pulse-glow cursor-pointer transition-transform hover:scale-110"
        >
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 md:w-96 h-[520px] flex flex-col z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-card/95 backdrop-blur-xl">
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
                <p className="text-[10px] text-white/70">Powered by Gemini</p>
              </div>
            </div>
            <button
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4 text-white" />
            </button>
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
                    {msg.text}
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
          <div className="p-3 border-t border-white/5 bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  context === "visitor"
                    ? "Book a slot, check status..."
                    : "Manage schedule, view bookings..."
                }
                disabled={loading || !!pendingCall}
                className="bg-white/5 border-white/5 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || loading || !!pendingCall}
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
