"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, RefreshCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// --- Types & Interfaces ---
type ChatStep = 
  | 'INITIAL' 
  | 'BOOKING_START' 
  | 'BOOKING_DATE' 
  | 'BOOKING_TIME'
  | 'BOOKING_DURATION'
  | 'BOOKING_EMAIL'
  | 'BOOKING_NAME'
  | 'BOOKING_CONFIRM'
  | 'CANCEL_START'
  | 'CANCEL_EMAIL'
  | 'CANCEL_CONFIRM'
  | 'VIEW_SCHEDULE'
  | 'VIEW_EMAIL'
  | 'BOOKING_VISITOR_EMAIL';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
}

const DEFAULT_MESSAGES: Message[] = [
  { id: '1', sender: 'bot', text: 'Hello! I am your automated scheduling assistant. How can I help you today?' }
];

export default function AutomatedChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [currentStep, setCurrentStep] = useState<ChatStep>('INITIAL');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const [isInitialized, setIsInitialized] = useState(false);

  // --- Temporary State for Flows ---
  const [bookingData, setBookingData] = useState({ date: '', time: '', duration: '', email: '', name: '', userId: '', visitorEmail: '' });
  const [cancelData, setCancelData] = useState({ email: '', bookings: [] as any[], selectedBookingId: '' });
  const [viewData, setViewData] = useState({ email: '', bookings: [] as any[] });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('myscheduler_chatbot_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.messages && parsed.messages.length > 0) setMessages(parsed.messages);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.bookingData) setBookingData(parsed.bookingData);
        if (parsed.cancelData) setCancelData(parsed.cancelData);
        if (parsed.viewData) setViewData(parsed.viewData);
      } catch (e) {
        console.error("Failed to parse chatbot state from localStorage");
      }
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('myscheduler_chatbot_state', JSON.stringify({
        messages, currentStep, bookingData, cancelData, viewData
      }));
    }
  }, [messages, currentStep, bookingData, cancelData, viewData, isInitialized]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const addMessage = (sender: 'bot' | 'user', text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender, text }]);
  };

  const resetFlow = (silently = false) => {
    setCurrentStep('INITIAL');
    setBookingData({ date: '', time: '', duration: '', email: '', name: '', userId: '', visitorEmail: '' });
    setCancelData({ email: '', bookings: [], selectedBookingId: '' });
    setViewData({ email: '', bookings: [] });
    if (!silently) {
      addMessage('bot', 'Okay, I have cancelled that. Is there anything else I can help you with?');
    }
  };

  const hardReset = () => {
    localStorage.removeItem('myscheduler_chatbot_state');
    setMessages(DEFAULT_MESSAGES);
    resetFlow(true);
  };

  const handleUserAction = async (action: string, value: string = '') => {
    const userText = value || action;
    addMessage('user', userText);

    // Global Cancel/Back check
    const lowerVal = userText.trim().toLowerCase();
    if (lowerVal === 'cancel' || lowerVal === 'back' || lowerVal === 'restart' || lowerVal === 'abort') {
      setTimeout(() => resetFlow(), 500);
      return;
    }

    setTimeout(async () => {
      switch (currentStep) {
        case 'INITIAL':
          if (action === 'BOOK') {
            addMessage('bot', 'Great. Please provide the email of the person you want to book with:');
            setCurrentStep('BOOKING_EMAIL');
          } else if (action === 'CANCEL') {
            addMessage('bot', 'To cancel a meeting, please provide your email address:');
            setCurrentStep('CANCEL_EMAIL');
          } else if (action === 'VIEW') {
            addMessage('bot', 'To view your upcoming schedule, please provide your email address:');
            setCurrentStep('VIEW_EMAIL');
          } else {
             addMessage('bot', "I didn't quite catch that. You can type 'Book', 'Cancel', or 'View'.");
          }
          break;

        // --- BOOKING FLOW ---
        case 'BOOKING_EMAIL':
          if (value.includes('@')) {
            const { data } = await supabase.from('profiles').select('id, display_name').eq('email', value.trim()).single();
            if (data) {
                setBookingData(prev => ({ ...prev, userId: data.id }));
                addMessage('bot', `Found ${data.display_name}. What date would you like to book? (YYYY-MM-DD)`);
                setCurrentStep('BOOKING_DATE');
            } else {
                addMessage('bot', 'Could not find a user with that email. Please try again or type "Cancel" to abort.');
            }
          } else {
            addMessage('bot', 'Please provide a valid email address.');
          }
          break;

        case 'BOOKING_DATE':
          setBookingData(prev => ({ ...prev, date: value }));
          addMessage('bot', `You selected ${value}. What time? (e.g., 14:00)`);
          setCurrentStep('BOOKING_TIME');
          break;

        case 'BOOKING_TIME':
          setBookingData(prev => ({ ...prev, time: value }));
          addMessage('bot', `Great. How long should the meeting be?`);
          setCurrentStep('BOOKING_DURATION');
          break;

        case 'BOOKING_DURATION':
          setBookingData(prev => ({ ...prev, duration: value }));
          addMessage('bot', `Almost done. Please provide your Name:`);
          setCurrentStep('BOOKING_NAME');
          break;

        case 'BOOKING_NAME':
            setBookingData(prev => ({ ...prev, name: value }));
            addMessage('bot', `Please provide your email address (so the host can accept or reject the booking):`);
            setCurrentStep('BOOKING_VISITOR_EMAIL');
            break;

        case 'BOOKING_VISITOR_EMAIL':
            if (value.includes('@')) {
               setBookingData(prev => ({ ...prev, visitorEmail: value.trim() }));
               const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
               addMessage('bot', `Confirm booking for ${bookingData.date} at ${bookingData.time} (${userTimezone}) for ${bookingData.duration || '1h'} as ${bookingData.name} (${value.trim()})?`);
               setCurrentStep('BOOKING_CONFIRM');
            } else {
               addMessage('bot', 'Please provide a valid email address.');
            }
            break;

        case 'BOOKING_CONFIRM':
          if (action === 'CONFIRM') {
            addMessage('bot', 'Processing your booking...');
            try {
              let startH = parseInt(bookingData.time.split(':')[0]);
              let startM = parseInt(bookingData.time.split(':')[1] || '0');
              let endH = startH;
              let endM = startM;
              
              const dur = bookingData.duration.toLowerCase();
              if (dur.includes('15m')) endM += 15;
              else if (dur.includes('30m')) endM += 30;
              else if (dur.includes('1h')) endH += 1;
              else endH += 1; // default 1h

              if (endM >= 60) {
                 endM -= 60;
                 endH += 1;
              }

              const formattedEndH = String(endH).padStart(2, '0');
              const formattedEndM = String(endM).padStart(2, '0');
              const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              
              const res = await fetch("/api/book", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: bookingData.userId,
                  date: bookingData.date,
                  startTime: `${bookingData.time}:00`,
                  endTime: `${formattedEndH}:${formattedEndM}:00`,
                  name: bookingData.name,
                  email: bookingData.visitorEmail,
                  description: `Booked via Chatbot (Timezone: ${userTimezone}, Duration: ${bookingData.duration})`,
                }),
              });
              
              if(res.ok) {
                  addMessage('bot', 'Booking confirmed! A request has been sent to the host.');
              } else {
                  addMessage('bot', 'Sorry, that slot might be unavailable or an error occurred.');
              }
            } catch (e) {
                addMessage('bot', 'An error occurred while communicating with the server.');
            }
            resetFlow(true);
          } else {
            addMessage('bot', 'Booking cancelled. Let\'s start over.');
            resetFlow(true);
          }
          break;
          
        // --- CANCEL FLOW ---
        case 'CANCEL_EMAIL':
          if (value.includes('@')) {
              setCancelData(prev => ({ ...prev, email: value.trim() }));
              addMessage('bot', 'Fetching your upcoming meetings...');
              const { data } = await supabase.from('bookings').select('*, schedules(*)').eq('visitor_email', value.trim());
              
              if (data && data.length > 0) {
                  const upcoming = data.filter(b => b.booking_status === 'Pending' || b.booking_status === 'Accepted');
                  if(upcoming.length > 0) {
                      setCancelData(prev => ({ ...prev, bookings: upcoming }));
                      addMessage('bot', `Found ${upcoming.length} upcoming meetings. Which one do you want to cancel?`);
                      setCurrentStep('CANCEL_START');
                  } else {
                      addMessage('bot', 'You have no upcoming meetings to cancel.');
                      resetFlow(true);
                  }
              } else {
                  addMessage('bot', 'No meetings found for this email.');
                  resetFlow(true);
              }
          } else {
            addMessage('bot', 'Please provide a valid email address.');
          }
          break;

        case 'CANCEL_START':
            if (action.startsWith('SELECT_')) {
                const id = action.replace('SELECT_', '');
                setCancelData(prev => ({ ...prev, selectedBookingId: id }));
                addMessage('bot', 'Are you sure you want to cancel this meeting?');
                setCurrentStep('CANCEL_CONFIRM');
            } else if(action === 'ABORT') {
                resetFlow();
            } else {
                addMessage('bot', 'Please select a meeting from the options above.');
            }
            break;

        case 'CANCEL_CONFIRM':
            if (action === 'CONFIRM') {
                addMessage('bot', 'Cancelling meeting...');
                const { error } = await supabase.from('bookings').update({ booking_status: 'Cancelled' }).eq('id', cancelData.selectedBookingId);
                if(error) {
                    addMessage('bot', 'Failed to cancel meeting.');
                } else {
                    addMessage('bot', 'Meeting cancelled successfully.');
                }
                resetFlow(true);
            } else {
                addMessage('bot', 'Okay, I will keep that meeting.');
                resetFlow(true);
            }
            break;

        // --- VIEW FLOW ---
        case 'VIEW_EMAIL':
            if (value.includes('@')) {
                addMessage('bot', 'Fetching your schedule...');
                const { data } = await supabase.from('bookings').select('*, schedules(*)').eq('visitor_email', value.trim());
                if (data && data.length > 0) {
                    const upcoming = data.filter(b => b.booking_status === 'Pending' || b.booking_status === 'Accepted');
                    if (upcoming.length > 0) {
                        addMessage('bot', `You have ${upcoming.length} upcoming meetings:`);
                        upcoming.forEach(b => {
                            addMessage('bot', `- ${b.schedules.date} at ${b.schedules.start_time.slice(0,5)} with ${b.schedules.title}`);
                        });
                    } else {
                        addMessage('bot', 'You have no upcoming meetings.');
                    }
                } else {
                    addMessage('bot', 'No meetings found for this email.');
                }
                resetFlow(true);
            } else {
                addMessage('bot', 'Please provide a valid email address.');
            }
            break;

        default:
          setCurrentStep('INITIAL');
          break;
      }
    }, 500);
  };

  const renderQuickReplies = () => {
    switch (currentStep) {
      case 'INITIAL':
        return (
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={() => handleUserAction('BOOK', 'Book a Meeting')} className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs hover:bg-primary/30 transition">Book Meeting</button>
            <button onClick={() => handleUserAction('CANCEL', 'Cancel a Meeting')} className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs hover:bg-red-500/30 transition">Cancel Meeting</button>
            <button onClick={() => handleUserAction('VIEW', 'View Schedule')} className="px-3 py-1.5 bg-white/10 text-white border border-white/20 rounded-full text-xs hover:bg-white/20 transition">View Schedule</button>
          </div>
        );
      case 'BOOKING_EMAIL':
      case 'CANCEL_EMAIL':
      case 'VIEW_EMAIL':
      case 'BOOKING_NAME':
      case 'BOOKING_VISITOR_EMAIL':
          return (
              <div className="flex gap-2 mt-2 w-full">
                 <input type="text" id="text-input" placeholder="Type here... (or type 'cancel')" className="flex-1 border border-white/10 bg-black/40 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/50" 
                    onKeyDown={(e) => {
                        if(e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            if(val) handleUserAction('SUBMIT', val);
                            (e.target as HTMLInputElement).value = '';
                        }
                    }}
                 />
                 <button onClick={() => {
                     const el = document.getElementById('text-input') as HTMLInputElement;
                     if(el.value) { handleUserAction('SUBMIT', el.value); el.value = ''; }
                 }} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:bg-primary/90 flex-shrink-0">Send</button>
              </div>
          );
      case 'BOOKING_DATE':
        return (
          <div className="flex gap-2 mt-2">
            <input type="date" id="date-picker" className="border border-white/10 bg-black/40 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50" />
            <button onClick={() => {
                const dateVal = (document.getElementById('date-picker') as HTMLInputElement).value;
                if(dateVal) handleUserAction('SUBMIT_DATE', dateVal);
            }} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:bg-primary/90">Next</button>
          </div>
        );
      case 'BOOKING_TIME':
        return (
          <div className="flex gap-2 mt-2">
            <input type="time" id="time-picker" className="border border-white/10 bg-black/40 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50" />
            <button onClick={() => {
                const timeVal = (document.getElementById('time-picker') as HTMLInputElement).value;
                if(timeVal) handleUserAction('SUBMIT_TIME', timeVal);
            }} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:bg-primary/90">Next</button>
          </div>
        );
      case 'BOOKING_DURATION':
        return (
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleUserAction('SUBMIT', '15m')} className="px-3 py-1.5 bg-white/10 text-white border border-white/20 rounded-full text-xs hover:bg-white/20">15m</button>
            <button onClick={() => handleUserAction('SUBMIT', '30m')} className="px-3 py-1.5 bg-white/10 text-white border border-white/20 rounded-full text-xs hover:bg-white/20">30m</button>
            <button onClick={() => handleUserAction('SUBMIT', '1h')} className="px-3 py-1.5 bg-white/10 text-white border border-white/20 rounded-full text-xs hover:bg-white/20">1h</button>
          </div>
        );
      case 'BOOKING_CONFIRM':
      case 'CANCEL_CONFIRM':
        return (
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleUserAction('CONFIRM', 'Yes, Confirm')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs hover:bg-emerald-500/30">Yes, Confirm</button>
            <button onClick={() => handleUserAction('REJECT', 'No, Cancel')} className="px-3 py-1.5 bg-white/10 text-white border border-white/20 rounded-full text-xs hover:bg-white/20">No, Cancel</button>
          </div>
        );
      case 'CANCEL_START':
          return (
              <div className="flex flex-col gap-2 mt-2">
                  {cancelData.bookings.map(b => (
                      <button key={b.id} onClick={() => handleUserAction(`SELECT_${b.id}`, `Cancel ${b.schedules.date}`)} className="px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-xs text-left hover:bg-white/10">
                          {b.schedules.date} at {b.schedules.start_time.slice(0,5)}
                      </button>
                  ))}
                  <button onClick={() => handleUserAction('ABORT', 'Nevermind')} className="px-3 py-1.5 bg-white/10 text-white border border-white/20 rounded-full text-xs hover:bg-white/20 self-start mt-2">Nevermind</button>
              </div>
          );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 flex items-center justify-center hover:bg-primary/90 hover:scale-105 transition-all z-50"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-[28rem] glass-card border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5">
          
          {/* Header */}
          <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-semibold text-sm">Automated Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={hardReset} className="text-muted-foreground hover:text-white transition-colors" title="Reset Chat History">
                    <RefreshCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 scrollbar-none">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.sender === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-br-sm shadow-md shadow-primary/20' 
                        : 'bg-white/10 border border-white/10 text-white rounded-bl-sm shadow-sm backdrop-blur-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input / Quick Replies Area */}
          <div className="p-3 bg-black/40 border-t border-white/10 backdrop-blur-md">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider flex justify-between">
              <span>Select an option or reply</span>
              {currentStep !== 'INITIAL' && <span className="text-primary/70">Type 'back' to restart</span>}
            </p>
            {renderQuickReplies()}
          </div>

        </div>
      )}
    </>
  );
}
