import { NextResponse } from "next/server";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";

/* ─────────────────────────────────────────────────────────
 *  Smart Local Chatbot Engine — NO external API needed
 *  Uses keyword-based intent detection + conversational
 *  flow to act as a highly intelligent tool-navigator.
 * ────────────────────────────────────────────────────────── */

// ── Helpers ──────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const dayName = () => new Date().toLocaleDateString("en-US", { weekday: "long" });

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function addDaysDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function nextWeekday(targetDay: string): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const idx = days.indexOf(targetDay.toLowerCase());
  if (idx === -1) return today();
  const d = new Date();
  const current = d.getDay();
  let diff = idx - current;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function resolveDate(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("today")) return today();
  if (lower.includes("tomorrow")) return tomorrow();
  if (lower.includes("day after tomorrow")) return addDaysDate(2);
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const day of weekdays) {
    if (lower.includes(day)) return nextWeekday(day);
  }
  // YYYY-MM-DD
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  return null;
}

function resolveTime(text: string): string | null {
  const lower = text.toLowerCase().replace(/\s+/g, " ").trim();
  // "10 am", "2pm", "10:00 am", "14:00"
  const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const ampm = match[3];
  
  const isPM = ampm === "pm" || lower.includes("pm") || lower.includes("evening") || lower.includes("night") || (lower.includes("afternoon") && hour < 12);
  const isAM = ampm === "am" || lower.includes("am") || lower.includes("morning");
  
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  if (hour < 5 || hour > 22) return null;
  return `${String(hour).padStart(2, "0")}:00:00`;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return match ? match[0] : null;
}

// ── Intent Detection ─────────────────────────────────────
type Intent =
  | "greeting"
  | "help"
  | "book_slot"
  | "check_status"
  | "view_schedule"
  | "add_slot"
  | "reschedule"
  | "delete_slot"
  | "manage_bookings"
  | "accept_booking"
  | "reject_booking"
  | "find_people"
  | "connect"
  | "view_connections"
  | "navigate"
  | "who_am_i"
  | "whose_page"
  | "forgot_password"
  | "how_to"
  | "available_slots"
  | "unknown";

function detectIntent(text: string): Intent {
  const t = text.toLowerCase();

  // Book (highest priority for visitor)
  if (/\b(book|schedule.*meeting|schedule.*appointment|reserve|make.*appointment|set.*meeting|need.*slot)\b/.test(t) || (/\bbook\b/.test(t) && /\bslot\b/.test(t)))
    return "book_slot";

  // Greetings
  if (/^(hi|hello|hey|howdy|yo|what's up|good morning|good evening|good afternoon|greetings)\b/.test(t))
    return "greeting";

  // Help
  if (/\b(help|what can you do|how do i|how does|guide|tutorial|explain|instructions)\b/.test(t) && !/\bbook\b/.test(t))
    return "help";

  // Password reset
  if (/\b(forgot|reset|lost).*(password|credentials)\b/.test(t) || /\bpassword.*(forgot|reset|lost)\b/.test(t))
    return "forgot_password";

  // Who am I
  if (/\b(who am i|my profile|my name|my email|my occupation|my account)\b/.test(t))
    return "who_am_i";

  // Whose page
  if (/\b(whose|who is|who'?s).*(page|schedule|profile|calendar|this)\b/.test(t))
    return "whose_page";

  // Accept booking
  if (/\b(accept|approve|confirm).*(booking|request|appointment)\b/.test(t))
    return "accept_booking";

  // Reject booking
  if (/\b(reject|decline|deny).*(booking|request|appointment)\b/.test(t))
    return "reject_booking";

  // Manage bookings / pending
  if (/\b(pending|booking request|manage booking|review booking|booking.*request)\b/.test(t))
    return "manage_bookings";

  // Check status
  if (/\b(status|track|check.*booking|my booking|my appointment|look.*up)\b/.test(t))
    return "check_status";

  // Available slots
  if (/\b(available|free|open).*(slot|time|hour|appointment)\b/.test(t) || /\bslots?\b/.test(t))
    return "available_slots";

  // View schedule
  if (/\b(my schedule|my calendar|what'?s on|schedule for|today'?s schedule|show.*schedule|view.*schedule|calendar)\b/.test(t))
    return "view_schedule";

  // Add slot
  if (/\b(add|create|new).*(slot|event|schedule|meeting|session)\b/.test(t))
    return "add_slot";

  // Reschedule
  if (/\b(reschedule|move|shift|change.*time|change.*date)\b/.test(t))
    return "reschedule";

  // Delete
  if (/\b(delete|remove|cancel).*(slot|event|schedule|meeting)\b/.test(t))
    return "delete_slot";

  // Find people
  if (/\b(find|search|look.*for|discover)\b/i.test(t) && !/\b(slot|time|hour|appointment|meeting|schedule)\b/i.test(t))
    return "find_people";

  // Connect
  if (/\b(connect|add.*friend|send.*request|connection)\b/.test(t))
    return "connect";

  // View connections
  if (/\b(my connections|my friends|connected|connections list)\b/.test(t))
    return "view_connections";

  // Navigate
  if (/\b(go to|navigate|take me|open|redirect|visit).*(page|dashboard|people|login|signup|home|schedule)\b/.test(t))
    return "navigate";

  // How-to
  if (/\bhow\b/.test(t))
    return "how_to";

  return "unknown";
}

// ── Response Builder ─────────────────────────────────────

function buildOwnerResponse(intent: Intent, text: string, history: any[]): any {
  const t = text.toLowerCase();

  switch (intent) {
    case "greeting":
      return {
        type: "text",
        text: `Hey there! 👋 I'm doing great, thanks for asking. How are you doing? I'm your scheduling assistant. What do you need help with today?`,
      };

    case "help":
      return {
        type: "text",
        text: `I'm a smart scheduling assistant! I can help you view your schedule, create new meetings, check up on pending booking requests, or even search for other users to connect with. Just tell me what you're trying to do in plain English! 😊`,
      };

    case "view_schedule": {
      const date = resolveDate(text) || today();
      return {
        type: "function_call",
        functionCall: { name: "getTodaySchedule", args: { date } },
      };
    }

    case "book_slot": {
      const withMatch = text.match(/with\s+([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?|[a-zA-Z]+)/i);
      const hostQuery = withMatch ? withMatch[1].trim() : null;

      if (hostQuery && hostQuery.toLowerCase() !== "me") {
        return {
          type: "function_call",
          functionCall: { name: "searchPeople", args: { query: hostQuery } },
        };
      }
      return {
        type: "text",
        text: `To book a slot, please tell me who you want to book with (e.g., "book a slot with Nagadhatri"). I will search for them and help you navigate to their schedule!`,
      };
    }

    case "available_slots": {
      const date = resolveDate(text) || today();
      return {
        type: "function_call",
        functionCall: { name: "getAvailableSlots", args: { date } },
      };
    }

    case "add_slot": {
      const date = resolveDate(text) || tomorrow();
      const time = resolveTime(text);
      if (time) {
        const endHour = parseInt(time.slice(0, 2)) + 1;
        const endTime = `${String(endHour).padStart(2, "0")}:00`;
        // Extract a title from the message or use a default
        const titleMatch = text.match(/(?:titled?|called?|named?|for)\s+"?([^"]+)"?/i);
        const title = titleMatch ? titleMatch[1].trim() : "Meeting";
        return {
          type: "function_call",
          functionCall: {
            name: "addSlot",
            args: {
              title,
              date,
              start_time: time.slice(0, 5),
              end_time: endTime,
              category: "Meeting",
            },
          },
        };
      }
      return {
        type: "text",
        text: `I'd love to help you add a slot! 📅\n\nPlease tell me:\n1. **What date?** (e.g., "tomorrow", "next Monday", "2026-06-25")\n2. **What time?** (e.g., "10 AM", "2 PM")\n3. **What's the title?** (e.g., "Team sync", "Client call")\n\nYou can say something like: *"Add a meeting tomorrow at 3 PM titled Team Standup"*`,
      };
    }

    case "reschedule":
      return {
        type: "text",
        text: `To reschedule a meeting, I need to find it first! 🔄\n\nPlease tell me:\n1. **Which date is the current meeting on?**\n2. **What time is it?**\n\nOr you can go to your **Dashboard** and click the 🔄 (orange refresh icon) on any slot to reschedule it visually.\n\nWould you like me to show your schedule so you can pick which meeting to reschedule?`,
      };

    case "delete_slot":
      return {
        type: "text",
        text: `To delete a slot, I need its details. 🗑️\n\nPlease tell me:\n1. **What date is the slot on?**\n2. **What time?**\n\nOr you can go to your **Dashboard**, find the slot, and click the ❌ button to remove it.\n\nWant me to show your schedule first so you can choose which slot to delete?`,
      };

    case "manage_bookings":
    case "accept_booking":
    case "reject_booking":
      return {
        type: "function_call",
        functionCall: { name: "queryBookings", args: { status: "Pending" } },
      };

    case "find_people": {
      const query = text.replace(/\b(find|search|look\s*for|discover|people|user|person|someone|please|can you|for|about|named|called|profile|schedule|calendar|with|to)\b/gi, "").trim();
      if (query.length > 1) {
        return {
          type: "function_call",
          functionCall: { name: "searchPeople", args: { query } },
        };
      }
      return {
        type: "text",
        text: `Who are you looking for? 🔍\n\nTell me their **name** or **email** and I'll find them for you!\n\nYou can also go to the **People** page to browse and discover users.`,
      };
    }

    case "connect": {
      const email = extractEmail(text);
      if (email) {
        return {
          type: "function_call",
          functionCall: { name: "searchPeople", args: { query: email } },
        };
      }
      return {
        type: "text",
        text: `I can help you connect with someone! 🤝\n\nPlease tell me their **name** or **email** so I can find them.\n\nOr navigate to the **People** page where you can search and send connection requests directly.`,
      };
    }

    case "view_connections":
      return {
        type: "function_call",
        functionCall: { name: "getConnections", args: {} },
      };

    case "who_am_i":
      return {
        type: "function_call",
        functionCall: { name: "getCurrentUser", args: {} },
      };

    case "navigate": {
      const path = resolveNavPath(text);
      if (path) {
        return {
          type: "function_call",
          functionCall: { name: "navigateToPage", args: { path } },
        };
      }
      return {
        type: "text",
        text: `Where would you like to go? Here are the main pages:\n\n🏠 **Dashboard** — /dashboard\n👥 **People** — /people\n🔐 **Login** — /login\n📝 **Sign Up** — /signup\n\nJust say "go to dashboard" or "take me to people page"!`,
      };
    }

    case "forgot_password": {
      const email = extractEmail(text);
      if (email) {
        return {
          type: "function_call",
          functionCall: { name: "requestPasswordReset", args: { email } },
        };
      }
      return {
        type: "text",
        text: `No worries, I can help you reset your password! 🔑\n\nPlease tell me your **email address** and I'll send you a reset link.`,
      };
    }

    case "how_to":
      return buildHowToResponse(text);

    default:
      return {
        type: "text",
        text: `Hmm, I'm not exactly sure what you mean. Could you explain what you want to do with your schedule? I'm here to help!`,
      };
  }
}

function buildVisitorResponse(intent: Intent, text: string, history: any[]): any {
  const t = text.toLowerCase();

  switch (intent) {
    case "greeting":
      return {
        type: "text",
        text: `Hey there! 👋 How are you? I'm your smart booking assistant. I can help you find time slots and connect with people. What are you looking to do today?`,
      };

    case "help":
      return {
        type: "text",
        text: `I'm a smart scheduling assistant! If you want to book an appointment, check on a previous booking, or find someone on the platform, just let me know in your own words. I'll guide you through it! 😊`,
      };

    case "book_slot": {
      const withMatch = text.match(/with\s+([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?|[a-zA-Z]+)/i);
      const hostQuery = withMatch ? withMatch[1].trim() : null;

      if (hostQuery && hostQuery.toLowerCase() !== "me" && !resolveDate(text)) {
        return {
          type: "function_call",
          functionCall: { name: "searchPeople", args: { query: hostQuery } },
        };
      }

      const date = resolveDate(text);
      const time = resolveTime(text);

      // If we have both date and time, check available slots first
      if (date && time) {
        return {
          type: "function_call",
          functionCall: { name: "getAvailableSlots", args: { date } },
        };
      }
      // If we have just a date, show available slots
      if (date) {
        return {
          type: "function_call",
          functionCall: { name: "getAvailableSlots", args: { date } },
        };
      }
      // No date yet, ask
      return {
        type: "text",
        text: `I'd love to help you book an appointment! 📅\n\nWhat **date** would you like to book?\n\nYou can say things like:\n• "Tomorrow"\n• "Next Monday"\n• "2026-06-25"\n\nI'll then show you all the available time slots! ⏰`,
      };
    }

    case "available_slots": {
      const date = resolveDate(text) || today();
      return {
        type: "function_call",
        functionCall: { name: "getAvailableSlots", args: { date } },
      };
    }

    case "check_status": {
      const email = extractEmail(text);
      if (email) {
        return {
          type: "function_call",
          functionCall: { name: "checkBookingStatus", args: { email } },
        };
      }
      return {
        type: "text",
        text: `I can look up your bookings! 📋\n\nPlease tell me the **email address** you used when booking, and I'll check the status for you.\n\nYou can also use the **Track My Bookings** panel on the left side of this page! 🔍`,
      };
    }

    case "find_people": {
      const query = text.replace(/\b(find|search|look\s*for|discover|people|user|person|someone|please|can you|for|about|named|called|profile|schedule|calendar|with|to)\b/gi, "").trim();
      if (query.length > 1) {
        return {
          type: "function_call",
          functionCall: { name: "searchPeople", args: { query } },
        };
      }
      return {
        type: "text",
        text: `Who are you looking for? 🔍\n\nTell me their **name** or **email** and I'll find them for you!`,
      };
    }

    case "connect": {
      const email = extractEmail(text);
      if (email) {
        return {
          type: "function_call",
          functionCall: { name: "searchPeople", args: { query: email } },
        };
      }
      return {
        type: "text",
        text: `I can help you connect with someone! 🤝\n\nPlease tell me their **name** or **email** so I can find them.\n\nOr head to the **People** page to browse and discover users!`,
      };
    }

    case "view_connections":
      return {
        type: "function_call",
        functionCall: { name: "getConnections", args: {} },
      };

    case "who_am_i":
      return {
        type: "function_call",
        functionCall: { name: "getCurrentUser", args: {} },
      };

    case "whose_page":
      return {
        type: "function_call",
        functionCall: { name: "getPageOwner", args: {} },
      };

    case "navigate": {
      const path = resolveNavPath(text);
      if (path) {
        return {
          type: "function_call",
          functionCall: { name: "navigateToPage", args: { path } },
        };
      }
      return {
        type: "text",
        text: `Where would you like to go? Here are the main pages:\n\n🏠 **Dashboard** — /dashboard\n👥 **People** — /people\n🔐 **Login** — /login\n📝 **Sign Up** — /signup\n\nJust say "go to dashboard" or "take me to people page"!`,
      };
    }

    case "forgot_password": {
      const email = extractEmail(text);
      if (email) {
        return {
          type: "function_call",
          functionCall: { name: "requestPasswordReset", args: { email } },
        };
      }
      return {
        type: "text",
        text: `No worries! I can help you reset your password. 🔑\n\nPlease tell me your **email address** and I'll send you a reset link right away.`,
      };
    }

    case "how_to":
      return buildHowToResponse(text);

    case "view_schedule": {
      const date = resolveDate(text) || today();
      return {
        type: "function_call",
        functionCall: { name: "getAvailableSlots", args: { date } },
      };
    }

    default:
      return {
        type: "text",
        text: `I'm not quite sure I caught that. I'm here to help you book appointments or search for users—what do you need help with?`,
      };
  }
}

// ── Follow-up Detection (conversational context) ─────────
function detectFollowUp(text: string, history: any[]): any | null {
  const t = text.toLowerCase().trim();
  if (history.length === 0) return null;

  const lastBotMsg = [...history].reverse().find((m: any) => m.role === "model" && m.text);
  const lastBotText = lastBotMsg?.text?.toLowerCase() || "";
  
  // If the text is a JSON search result, let's ask the user for a date!
  if (t.startsWith('{"users"')) {
    try {
      const data = JSON.parse(t);
      if (data.users && data.users.length > 0) {
        return {
          type: "text",
          text: `I found them! Awesome. What **date** would you like to book a slot for? (e.g. tomorrow, next Monday, 2026-06-25)`
        };
      } else {
        return {
          type: "text",
          text: `I couldn't find anyone by that name. Could you double-check the spelling or try their email?`
        };
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // If the text is a JSON available slots result, ask the user to pick one
  if (t.startsWith('{"available_slots"')) {
    try {
      const data = JSON.parse(t);
      if (data.available_slots && data.available_slots.length > 0) {
        return {
          type: "text",
          text: `Great! Here are the available slots for ${data.date}. Please pick a time (e.g., "10:00 AM"), and we'll get it booked!`
        };
      } else {
        return {
          type: "text",
          text: `It looks like there are no slots available for that date. Would you like to try another day?`
        };
      }
    } catch (e) {
      // ignore
    }
  }

  // 0. Check if user is asking to change duration (e.g. "30 mins") during a booking flow:
  if (lastBotText.includes("finalize your booking") || lastBotText.includes("selected") || lastBotText.includes("what's your full name?") || lastBotText.includes("reason for the meeting")) {
    if (/\b(30|thirty|half|duration|length)\b/i.test(t) && /\b(min|minute|hour)\b/i.test(t)) {
      return {
        type: "text",
        text: `⚠️ MyScheduler currently only supports standard **1-hour** slots to keep scheduling simple and consistent.\n\nWould you like to proceed with the 1-hour booking at this time? If so, please tell me **Your full name** to get started!`,
      };
    }
  }

  // Handle asking for a date
  if (lastBotText.includes("what **date** would you like to book")) {
    const d = resolveDate(text);
    if (d) {
      return {
        type: "function_call",
        functionCall: { name: "getAvailableSlots", args: { date: d } }
      };
    } else {
      return {
        type: "text",
        text: `I couldn't quite understand that date. Could you please provide a clear date, like "tomorrow", "Friday", or "2026-06-25"?`
      };
    }
  }

  // Handle asking for a time
  if (lastBotText.includes("please pick a time") || lastBotText.includes("pick a time")) {
    const tm = resolveTime(text);
    if (tm) {
      return {
        type: "text",
        text: `Great choice! ⏰ **${formatTimeReadable(tm)}**. Let's get those details step-by-step! First, **what is your full name**?`
      };
    } else {
      return {
        type: "text",
        text: `I didn't catch that time. Could you reply with a time like "10:00 AM" or "14:00"?`
      };
    }
  }

  // 0.1. If the last bot message asked for all information at once (during Gemini fallback or local booking init)
  if (lastBotText.includes("finalize your booking") && !lastBotText.includes("what's your full name?")) {
    return {
      type: "text",
      text: `Let's get those details step-by-step! First, **what is your full name**?`,
    };
  }

  // 1. If the bot asked for Name:
  if (lastBotText.includes("what's your full name?") || lastBotText.includes("your full name")) {
    const name = text.trim();
    if (name.length > 1) {
      return {
        type: "text",
        text: `Thanks, **${name}**! What is your email address?`,
      };
    }
  }

  // 2. If the bot asked for Email:
  if (lastBotText.includes("what is your email address?")) {
    const email = extractEmail(text);
    if (email) {
      return {
        type: "text",
        text: `Got it! Please provide a brief description/reason for the meeting.`,
      };
    } else {
      return {
        type: "text",
        text: `Please enter a valid email address so the host can contact you. What is your email address?`,
      };
    }
  }

  // 3. If the bot asked for Description:
  if (lastBotText.includes("description/reason") || lastBotText.includes("description is currently")) {
    const desc = text.trim();
    const wordCount = desc.split(/\s+/).length;
    
    // Extract name and email from history to prepare confirmation
    let nameVal = "";
    let emailVal = "";
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "model" && msg.text) {
        if (msg.text.includes("Thanks, **") && !nameVal) {
          const m = msg.text.match(/Thanks, \*\*([^*]+)\*\*/);
          if (m) nameVal = m[1];
        }
        if (msg.text.includes("email address?") && !emailVal && history[i+1] && history[i+1].role === "user") {
          emailVal = extractEmail(history[i+1].text || "") || "";
        }
      }
    }

    if (wordCount < 1) {
      return {
        type: "text",
        text: `Please enter a valid description/reason for the meeting.`,
      };
    } else {
      // Find date and time from history:
      let dateVal = today();
      let timeVal = "09:00:00";
      for (const h of history) {
        if (h.role === "function" && h.name === "getAvailableSlots") {
          dateVal = h.response?.date || dateVal;
        }
        if (h.role === "model" && h.text) {
          const tm = h.text.match(/Great choice! ⏰ \*\*([0-9:]+\s*[APM]+)\*\*/i);
          if (tm) timeVal = resolveTime(tm[1]) || timeVal;
        }
      }
      const hour = parseInt(timeVal.slice(0, 2));
      const endH = `${String(hour + 1).padStart(2, "0")}:00:00`;

      return {
        type: "text",
        text: `Perfect! I'll book you for **${dateVal}** at **${formatTimeReadable(timeVal)}**. This will be a 1-hour slot, ending at **${formatTimeReadable(endH)}**.\n\nHere are the details:\n• **Name:** ${nameVal}\n• **Email:** ${emailVal}\n• **Description:** "${desc}"\n\nDoes this look correct? Please say **yes** or **confirm** to submit!`,
      };
    }
  }

  // 4. If the bot asked to confirm (e.g. "Does this look correct?"):
  if (lastBotText.includes("does this look correct?") && /^(yes|yeah|yep|sure|ok|okay|go ahead|confirm|do it|submit|please|please do)\b/.test(t)) {
    // Reconstruct all details from history:
    let nameVal = "";
    let emailVal = "";
    let descVal = "";
    let dateVal = today();
    let timeVal = "09:00:00";

    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "model" && msg.text) {
        if (msg.text.includes("Does this look correct?")) {
          // Parse the confirmation text details:
          const nameM = msg.text.match(/Name:\*\* ([^\n]+)/);
          const emailM = msg.text.match(/Email:\*\* ([^\n]+)/);
          const descM = msg.text.match(/Description:\*\* "([^"]+)"/);
          const dateM = msg.text.match(/book you for \*\*([0-9-]+)\*\*/);
          const timeM = msg.text.match(/at \*\*([0-9:]+\s*[APM]+)\*\*/);
          
          if (nameM) nameVal = nameM[1];
          if (emailM) emailVal = emailM[1];
          if (descM) descVal = descM[1];
          if (dateM) dateVal = dateM[1];
          if (timeM) timeVal = resolveTime(timeM[1]) || timeVal;
        }
      }
    }

    const hour = parseInt(timeVal.slice(0, 2));
    const endH = `${String(hour + 1).padStart(2, "0")}:00:00`;

    return {
      type: "function_call",
      functionCall: {
        name: "bookAppointment",
        args: {
          name: nameVal,
          email: emailVal,
          date: dateVal,
          start_time: timeVal,
          end_time: endH,
          description: descVal,
        },
      },
    };
  }

  // User says "navigate me" or "sure" after a search result
  if (lastBotText.includes("search results") || lastBotText.includes("view schedule")) {
    const match = lastBotText.match(/\/visit\/([\w-]+)/);
    if (match && /^(yes|yeah|yep|sure|ok|okay|go ahead|navigate|take me|show|open|navigate me)\b/.test(t)) {
      return {
        type: "function_call",
        functionCall: { name: "navigateToPage", args: { path: `/visit/${match[1]}` } },
      };
    }
  }

  // User is providing a date after being asked
  if (lastBotText.includes("what date") || lastBotText.includes("what **date**")) {
    const date = resolveDate(text);
    if (date) {
      return {
        type: "function_call",
        functionCall: { name: "getAvailableSlots", args: { date } },
      };
    }
  }

  // User is providing an email after being asked
  if (lastBotText.includes("email address") || lastBotText.includes("your **email")) {
    const email = extractEmail(text);
    if (email) {
      // Check if we were asking for booking status
      if (lastBotText.includes("booking") || lastBotText.includes("status")) {
        return {
          type: "function_call",
          functionCall: { name: "checkBookingStatus", args: { email } },
        };
      }
      // Password reset
      if (lastBotText.includes("password") || lastBotText.includes("reset")) {
        return {
          type: "function_call",
          functionCall: { name: "requestPasswordReset", args: { email } },
        };
      }
      // Search people
      return {
        type: "function_call",
        functionCall: { name: "searchPeople", args: { query: email } },
      };
    }
  }

  // User is providing a name/query after "Who are you looking for?"
  if (lastBotText.includes("who are you looking for") || lastBotText.includes("tell me their")) {
    if (t.length > 1) {
      return {
        type: "function_call",
        functionCall: { name: "searchPeople", args: { query: text.trim() } },
      };
    }
  }

  // User says "yes"/"confirm"/"go ahead" after being asked to confirm
  if (/^(yes|yeah|yep|sure|ok|okay|go ahead|confirm|do it|submit|please|please do)\b/.test(t)) {
    // Check if the last message was asking about schedule view
    if (lastBotText.includes("show your schedule")) {
      return {
        type: "function_call",
        functionCall: { name: "getTodaySchedule", args: { date: today() } },
      };
    }
  }

  // User providing a time (follow-up to slot listing)
  const time = resolveTime(text);
  if (time && (lastBotText.includes("which time") || lastBotText.includes("available slots") || lastBotText.includes("✅"))) {
    return {
      type: "text",
      text: `Great choice! ⏰ **${formatTimeReadable(time)}** is selected.\n\nTo complete the booking, I need a few more details:\n1. **Your full name**\n2. **Your email address**\n3. **Reason for the meeting**\n\nWhat's your full name?`,
    };
  }

  return null;
}

function formatTimeReadable(time: string): string {
  const hour = parseInt(time.slice(0, 2));
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:00 ${ampm}`;
}

// ── Navigation Resolver ──────────────────────────────────
function resolveNavPath(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bdashboard\b/.test(t)) return "/dashboard";
  if (/\bpeople\b/.test(t)) return "/people";
  if (/\blogin\b/.test(t)) return "/login";
  if (/\bsign\s*up\b/.test(t)) return "/signup";
  if (/\bhome\b/.test(t)) return "/";
  if (/\bowner\b/.test(t)) return "/owner";
  if (/\bvisit\b/.test(t)) return "/visit";
  return null;
}

// ── How-to Responses ─────────────────────────────────────
function buildHowToResponse(text: string): any {
  const t = text.toLowerCase();

  if (/sign\s*up|create.*account|register/i.test(t)) {
    return {
      type: "text",
      text: `Here's how to create an account on MyScheduler! 📝\n\n1. Go to the **Sign Up** page (click "Sign Up" in the navbar or I can take you there)\n2. Enter your **Name**, **Email**, **Password** (min 6 characters), and **Occupation**\n3. Click **Sign Up**\n4. 📧 **Check your email inbox** and click the verification link to confirm your account\n5. Come back and **Login** with your credentials\n6. You're all set! 🎉\n\nWould you like me to take you to the Sign Up page?`,
    };
  }

  if (/book|appointment|meeting|reserve/i.test(t)) {
    return {
      type: "text",
      text: `Here's how to book an appointment! 📅\n\n1. **Find the person** you want to book with:\n   • Go to **People** page → search by name/email → send a **Connect** request\n   • Wait for them to **accept** your connection\n2. Once connected, click **View Schedule** on their profile\n3. **Pick a date** on the calendar\n4. Browse the **available time slots**\n5. Click **Book** on your preferred slot\n6. Fill in your **name, email, and reason**\n7. Submit! The owner will review and accept/reject your request ✅\n\nOr just tell me *"I want to book a slot"* and I'll guide you through it right here! 😊`,
    };
  }

  if (/connect|friend|find.*people/i.test(t)) {
    return {
      type: "text",
      text: `Here's how to connect with people! 🤝\n\n1. Go to the **People** page (or say "go to People page")\n2. Use the **search bar** to find someone by name or email\n3. Click **Connect** next to their profile\n4. Wait for them to **accept** your request\n5. Once accepted, you can **view their schedule** and book appointments!\n\nYou can also check the **"People You May Know"** section for suggestions! ✨`,
    };
  }

  if (/reschedule|move.*meeting|change.*time/i.test(t)) {
    return {
      type: "text",
      text: `Here's how to reschedule a meeting! 🔄\n\n1. Go to your **Dashboard**\n2. Find the slot you want to move\n3. Click the **🔄 orange refresh icon** on that slot\n4. Pick a **new date** and **new time**\n5. Click **Reschedule** — the old slot gets marked "Rescheduled" and a new one is created!\n\nAll affected bookings will be updated automatically. 📋`,
    };
  }

  if (/accept|reject|manage.*booking/i.test(t)) {
    return {
      type: "text",
      text: `Here's how to manage booking requests! 📋\n\n1. Go to your **Dashboard**\n2. Look at the **right panel** for "Booking Requests"\n3. You'll see **pending requests** from visitors\n4. Click **✅ Accept** or **❌ Reject** on each request\n5. You can also add **remarks** when accepting\n\nOr just ask me: *"Show me pending bookings"* and I'll fetch them for you! 😊`,
    };
  }

  if (/password|login|sign\s*in/i.test(t)) {
    return {
      type: "text",
      text: `**Login Help 🔐**\n\n**To login:**\n1. Go to the **Login** page\n2. Enter your **email** and **password**\n3. Click **Sign In**\n\n**Forgot your password?**\n• Click **"Forgot Password?"** on the login page, OR\n• Tell me your email and I'll send you a reset link! 🔑\n\n**Can't login after signing up?**\n• Make sure you've **verified your email** — check your inbox for a confirmation link! 📧`,
    };
  }

  return {
    type: "text",
    text: `Great question! Here are the main things you can do on MyScheduler:\n\n📅 **Schedule** — Add, view, edit, reschedule, or delete time slots\n📋 **Bookings** — Accept/reject booking requests from visitors\n👥 **People** — Search, connect, and view other users' schedules\n🔍 **Track** — Check the status of your bookings by email\n\nWhat specific feature would you like to learn about? I can give you step-by-step instructions! 😊`,
  };
}

// ── Format function results into readable text ───────────
function formatFunctionResult(name: string, response: any): string {
  if (response.error) {
    return `⚠️ ${response.error}`;
  }

  switch (name) {
    case "getTodaySchedule": {
      const schedules = response.schedules || [];
      if (schedules.length === 0) return "📅 No scheduled events found for this date. Your calendar is free!";
      const lines = schedules.map((s: any) => {
        const startHour = parseInt(s.start_time?.slice(0, 2) || "0");
        const endHour = parseInt(s.end_time?.slice(0, 2) || "0");
        const ampmS = startHour >= 12 ? "PM" : "AM";
        const ampmE = endHour >= 12 ? "PM" : "AM";
        const status = s.status === "Upcoming" ? "🟢" : s.status === "Rescheduled" ? "🟠" : "⚪";
        return `${status} **${s.title || "Slot"}** — ${startHour % 12 || 12}:00 ${ampmS} to ${endHour % 12 || 12}:00 ${ampmE} (${s.category || "Other"})`;
      });
      return `📅 **Schedule for ${schedules[0]?.date || "this date"}:**\n\n${lines.join("\n")}`;
    }

    case "getAvailableSlots": {
      const slots = response.available_slots || [];
      if (slots.length === 0) return "😕 No available slots for this date. All slots are either booked or the date has passed.";
      const lines = slots.map((s: any, i: number) => {
        const time = s.time || s.start_time || "";
        const startHour = parseInt(time.slice(0, 2));
        const ampm = startHour >= 12 ? "PM" : "AM";
        return `${i + 1}. ✅ **${startHour % 12 || 12}:00 ${ampm} – ${(startHour + 1) % 12 || 12}:00 ${(startHour + 1) >= 12 ? "PM" : "AM"}**`;
      });
      return `📅 **Available slots for ${response.date || "this date"}:**\n\n${lines.join("\n")}\n\nWould you like to book one of these slots? Just tell me which time works for you! ⏰`;
    }

    case "checkBookingStatus": {
      const bookings = response.bookings || [];
      if (bookings.length === 0) return "📋 No bookings found for this email address. Make sure you entered the correct email!";
      const lines = bookings.map((b: any) => {
        const status =
          b.booking_status === "Accepted" || b.booking_status === "Accepted with Remarks" ? "✅" :
          b.booking_status === "Rejected" ? "❌" :
          b.booking_status === "Rescheduled" ? "🔄" : "⏳";
        return `${status} **${b.booking_status}** — ${b.schedule?.date || "N/A"} at ${b.schedule?.start_time?.slice(0, 5) || "N/A"} (${b.schedule?.title || "Meeting"})`;
      });
      return `📋 **Your bookings:**\n\n${lines.join("\n")}`;
    }

    case "queryBookings": {
      const bookings = response.bookings || [];
      if (bookings.length === 0) return "📋 No booking requests found! You're all caught up. ✅";
      const lines = bookings.map((b: any) => {
        const status = b.booking_status === "Pending" ? "⏳" : b.booking_status === "Accepted" ? "✅" : "❌";
        return `${status} **${b.visitor_name || "Visitor"}** (${b.visitor_email || "N/A"}) — ${b.schedule?.date || ""} at ${b.schedule?.start_time?.slice(0, 5) || ""}\n   Status: **${b.booking_status}** | Reason: ${b.description?.slice(0, 50) || "N/A"}...`;
      });
      return `📋 **Booking Requests:**\n\n${lines.join("\n\n")}\n\nWould you like me to accept or reject any of these?`;
    }

    case "searchPeople": {
      const users = response.users || [];
      if (users.length === 0) return "🔍 No users found matching that search. Try a different name or email!";
      const lines = users.map((u: any) => `• **${u.display_name || "User"}** — ${u.occupation || "N/A"} (${u.email}) [View Schedule](/visit/${u.id})`);
      return `🔍 **Search Results:**\n\n${lines.join("\n")}\n\nWould you like to navigate to their schedule? Click [View Schedule](/visit/${users[0].id}) or just ask me to navigate you!`;
    }

    case "getConnections": {
      const conns = response.connections || [];
      if (conns.length === 0) return "👥 You have no connections yet. Go to the People page to find and connect with others!";
      const lines = conns.map((c: any) => {
        const person = c.requester || c.receiver;
        const status = c.status === "accepted" ? "✅" : c.status === "pending" ? "⏳" : "❌";
        return `${status} **${person?.display_name || "User"}** — ${person?.email || ""} (${c.status})`;
      });
      return `👥 **Your Connections:**\n\n${lines.join("\n")}`;
    }

    case "getCurrentUser": {
      const user = response.user;
      if (!user) return "⚠️ You're not logged in. Would you like me to take you to the Login page?";
      return `👤 **Your Profile:**\n\n• **Name:** ${user.display_name}\n• **Email:** ${user.email}\n• **Occupation:** ${user.occupation || "Not set"}`;
    }

    case "getPageOwner": {
      const owner = response.owner;
      if (!owner) return "⚠️ Could not find the owner of this page.";
      return `👤 **Page Owner:**\n\n• **Name:** ${owner.display_name}\n• **Email:** ${owner.email}\n• **Occupation:** ${owner.occupation || "Not set"}`;
    }

    case "navigateToPage":
      return `✅ Navigating you now... 🚀`;

    case "addSlot":
      return response.success ? "✅ Slot added successfully to your calendar! 🎉" : `⚠️ Failed to add slot: ${response.error}`;

    case "deleteSlot":
      const OWNER_TOOLS = [
  {
    name: "getTodaySchedule",
    description: "Get the owner's schedule for today or a specific date.",
    parameters: {
      type: "object" as const,
      properties: {
        date: { type: "string" as const, description: "Optional date in YYYY-MM-DD format. Defaults to today if not provided." },
      },
    },
  },
  {
    name: "queryBookings",
    description: "Query pending booking requests that need action, or all bookings.",
    parameters: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, description: "Filter by status: 'Pending', 'Accepted', 'Rejected', or 'all'. Defaults to 'Pending'." },
      },
    },
  },
  {
    name: "addSlot",
    description: "Add a new schedule slot to the owner's calendar.",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const },
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format" },
        start_time: { type: "string" as const, description: "Start time in HH:mm format" },
        end_time: { type: "string" as const, description: "End time in HH:mm format" },
        category: { type: "string" as const, enum: ["Meeting", "Presentation", "Event Participation", "Learning", "Other"] },
        description: { type: "string" as const, description: "Optional description" },
      },
      required: ["title", "date", "start_time", "end_time", "category"],
    },
  },
  {
    name: "rescheduleSlot",
    description: "Move an existing schedule slot to a new date/time. Marks the old slot as 'Rescheduled' and creates a new 'Upcoming' slot.",
    parameters: {
      type: "object" as const,
      properties: {
        slot_id: { type: "string" as const, description: "The ID of the schedule to reschedule" },
        new_date: { type: "string" as const, description: "New date in YYYY-MM-DD format" },
        new_start_time: { type: "string" as const, description: "New start time in HH:mm format" },
        new_end_time: { type: "string" as const, description: "New end time in HH:mm format" },
        reason: { type: "string" as const, description: "Optional reason for rescheduling" },
      },
      required: ["slot_id", "new_date", "new_start_time", "new_end_time"],
    },
  },
  {
    name: "deleteSlot",
    description: "Delete a schedule slot by its ID.",
    parameters: {
      type: "object" as const,
      properties: { id: { type: "string" as const } },
      required: ["id"],
    },
  },
  {
    name: "respondToBooking",
    description: "Accept, reject, or add remarks to a pending booking request.",
    parameters: {
      type: "object" as const,
      properties: {
        booking_id: { type: "string" as const },
        action: { type: "string" as const, enum: ["Accepted", "Accepted with Remarks", "Rejected"] },
        remarks: { type: "string" as const, description: "Optional message to send to the visitor" },
      },
      required: ["booking_id", "action"],
    },
  },
  {
    name: "searchPeople",
    description: "Search for other users by name or email to connect with them. If query is omitted or empty, it returns a general list of suggested users on the platform.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Optional name or email to search for" },
      },
    },
  },
  {
    name: "sendConnectionRequest",
    description: "Send a connection request to another user by their ID.",
    parameters: {
      type: "object" as const,
      properties: {
        receiver_id: { type: "string" as const, description: "The ID of the user to connect with" },
      },
      required: ["receiver_id"],
    },
  },
  {
    name: "getConnections",
    description: "Get the user's connections (pending, accepted, or rejected).",
    parameters: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, description: "Optional filter by status: 'pending', 'accepted', 'rejected'. If omitted, returns all." },
      },
    },
  },
  {
    name: "getCurrentUser",
    description: "Get the profile details of the currently logged-in user (such as name, email, occupation). Use this when the user asks 'who am I?', 'what is my occupation?', or 'what is my profile?'.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "navigateToPage",
    description: "Navigate/redirect the user to a specific page on the website. Use this when the user explicitly asks to go to a page (like '/dashboard', '/people', '/login', '/signup', or '/schedule/[userId]'), or gives permission to be redirected.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "The relative path to navigate to (e.g., '/people', '/dashboard', '/login', '/schedule/some-user-id')" },
      },
      required: ["path"],
    },
  },
];

const VISITOR_TOOLS = [
  {
    name: "getAvailableSlots",
    description: "Get available 1-hour time slots for a specific date. Returns slots from 5 AM to 11 PM that are not yet booked.",
    parameters: {
      type: "object" as const,
      properties: {
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format" },
      },
      required: ["date"],
    },
  },
  {
    name: "bookAppointment",
    description: "Book an appointment at a specific time slot. Creates a pending booking request that the schedule owner will review.",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Visitor's full name" },
        email: { type: "string" as const, description: "Visitor's email address" },
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format" },
        start_time: { type: "string" as const, description: "Start time in HH:mm:ss format (e.g., 10:00:00)" },
        end_time: { type: "string" as const, description: "End time in HH:mm:ss format (e.g., 11:00:00)" },
        description: { type: "string" as const, description: "Brief reason for the meeting (a few words is fine, NO minimum word count)" },
      },
      required: ["name", "email", "date", "start_time", "end_time", "description"],
    },
  },
  {
    name: "checkBookingStatus",
    description: "Check the status of bookings by email address. Shows whether bookings are pending, accepted, rejected, etc.",
    parameters: {
      type: "object" as const,
      properties: { email: { type: "string" as const } },
      required: ["email"],
    },
  },
  {
    name: "searchPeople",
    description: "Search for other users by name or email to connect with them. If query is omitted or empty, it returns a general list of suggested users on the platform.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Optional name or email to search for" },
      },
    },
  },
  {
    name: "sendConnectionRequest",
    description: "Send a connection request to another user by their ID.",
    parameters: {
      type: "object" as const,
      properties: {
        receiver_id: { type: "string" as const, description: "The ID of the user to connect with" },
      },
      required: ["receiver_id"],
    },
  },
  {
    name: "getConnections",
    description: "Get the user's connections (pending, accepted, or rejected).",
    parameters: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, description: "Optional filter by status: 'pending', 'accepted', 'rejected'. If omitted, returns all." },
      },
    },
  },
  {
    name: "getCurrentUser",
    description: "Get the profile details of the currently logged-in user (such as name, email, occupation). Use this when the user asks 'who am I?', 'what is my occupation?', or 'what is my profile?'.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "getPageOwner",
    description: "Get the profile details of the user whose schedule page the visitor is currently viewing (name, email, occupation). Use this when the visitor asks 'whose schedule is this?', 'who is the owner?', or 'what is the owner's occupation?'.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "navigateToPage",
    description: "Navigate/redirect the user to a specific page on the website. Use this when the user explicitly asks to go to a page (like '/dashboard', '/people', '/login', '/signup', or '/schedule/[userId]'), or gives permission to be redirected.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "The relative path to navigate to (e.g., '/people', '/dashboard', '/login', '/schedule/some-user-id')" },
      },
      required: ["path"],
    },
  },
  {
    name: "requestPasswordReset",
    description: "Request a password reset link for a user's email address. Use this when the user says they forgot their password, and you have confirmed their email address.",
    parameters: {
      type: "object" as const,
      properties: {
        email: { type: "string" as const, description: "The email address of the account to reset" },
      },
      required: ["email"],
    },
  },
];
      return response.success ? "🗑️ Slot deleted successfully!" : `⚠️ Failed to delete: ${response.error}`;

    case "bookAppointment":
      return response.success ? "🎉 Your booking request has been submitted! The owner will review it and you'll be notified. Check back using 'Track My Bookings'!" : `⚠️ Booking failed: ${response.error}`;

    case "sendConnectionRequest":
      return response.success ? "🤝 Connection request sent! They'll see it in their Incoming Requests." : `⚠️ Failed: ${response.error}`;

    case "respondToBooking":
      return response.success ? `✅ ${response.message}` : `⚠️ Failed: ${response.error}`;

    case "rescheduleSlot":
      return response.success ? `🔄 ${response.message}` : `⚠️ Failed: ${response.error}`;

    case "requestPasswordReset":
      return response.success ? `📧 ${response.message} Check your inbox (and spam folder)!` : `⚠️ Failed: ${response.error}`;

    default:
      return response.success ? "✅ Done!" : `Result: ${JSON.stringify(response).slice(0, 200)}`;
  }
}

// ── Main API Handler ─────────────────────────────────────

const OWNER_TOOLS = [
  {
    name: "getTodaySchedule",
    description: "Get the owner's schedule for today or a specific date.",
    parameters: {
      type: "object" as const,
      properties: {
        date: { type: "string" as const, description: "Optional date in YYYY-MM-DD format. Defaults to today if not provided." },
      },
    },
  },
  {
    name: "queryBookings",
    description: "Query pending booking requests that need action, or all bookings.",
    parameters: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, description: "Filter by status: 'Pending', 'Accepted', 'Rejected', or 'all'. Defaults to 'Pending'." },
      },
    },
  },
  {
    name: "addSlot",
    description: "Add a new schedule slot to the owner's calendar.",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const },
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format" },
        start_time: { type: "string" as const, description: "Start time in HH:mm format" },
        end_time: { type: "string" as const, description: "End time in HH:mm format" },
        category: { type: "string" as const, enum: ["Meeting", "Presentation", "Event Participation", "Learning", "Other"] },
        description: { type: "string" as const, description: "Optional description" },
      },
      required: ["title", "date", "start_time", "end_time", "category"],
    },
  },
  {
    name: "rescheduleSlot",
    description: "Move an existing schedule slot to a new date/time. Marks the old slot as 'Rescheduled' and creates a new 'Upcoming' slot.",
    parameters: {
      type: "object" as const,
      properties: {
        slot_id: { type: "string" as const, description: "The ID of the schedule to reschedule" },
        new_date: { type: "string" as const, description: "New date in YYYY-MM-DD format" },
        new_start_time: { type: "string" as const, description: "New start time in HH:mm format" },
        new_end_time: { type: "string" as const, description: "New end time in HH:mm format" },
        reason: { type: "string" as const, description: "Optional reason for rescheduling" },
      },
      required: ["slot_id", "new_date", "new_start_time", "new_end_time"],
    },
  },
  {
    name: "deleteSlot",
    description: "Delete a schedule slot by its ID.",
    parameters: {
      type: "object" as const,
      properties: { id: { type: "string" as const } },
      required: ["id"],
    },
  },
  {
    name: "respondToBooking",
    description: "Accept, reject, or add remarks to a pending booking request.",
    parameters: {
      type: "object" as const,
      properties: {
        booking_id: { type: "string" as const },
        action: { type: "string" as const, enum: ["Accepted", "Accepted with Remarks", "Rejected"] },
        remarks: { type: "string" as const, description: "Optional message to send to the visitor" },
      },
      required: ["booking_id", "action"],
    },
  },
  {
    name: "searchPeople",
    description: "Search for other users by name or email to connect with them. If query is omitted or empty, it returns a general list of suggested users on the platform.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Optional name or email to search for" },
      },
    },
  },
  {
    name: "sendConnectionRequest",
    description: "Send a connection request to another user by their ID.",
    parameters: {
      type: "object" as const,
      properties: {
        receiver_id: { type: "string" as const, description: "The ID of the user to connect with" },
      },
      required: ["receiver_id"],
    },
  },
  {
    name: "getConnections",
    description: "Get the user's connections (pending, accepted, or rejected).",
    parameters: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, description: "Optional filter by status: 'pending', 'accepted', 'rejected'. If omitted, returns all." },
      },
    },
  },
  {
    name: "getCurrentUser",
    description: "Get the profile details of the currently logged-in user (such as name, email, occupation). Use this when the user asks 'who am I?', 'what is my occupation?', or 'what is my profile?'.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "navigateToPage",
    description: "Navigate/redirect the user to a specific page on the website. Use this when the user explicitly asks to go to a page (like '/dashboard', '/people', '/login', '/signup', or '/schedule/[userId]'), or gives permission to be redirected.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "The relative path to navigate to (e.g., '/people', '/dashboard', '/login', '/schedule/some-user-id')" },
      },
      required: ["path"],
    },
  },
];

const VISITOR_TOOLS = [
  {
    name: "getAvailableSlots",
    description: "Get available 1-hour time slots for a specific date. Returns slots from 5 AM to 11 PM that are not yet booked.",
    parameters: {
      type: "object" as const,
      properties: {
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format" },
      },
      required: ["date"],
    },
  },
  {
    name: "bookAppointment",
    description: "Book an appointment at a specific time slot. Creates a pending booking request that the schedule owner will review.",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Visitor's full name" },
        email: { type: "string" as const, description: "Visitor's email address" },
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format" },
        start_time: { type: "string" as const, description: "Start time in HH:mm:ss format (e.g., 10:00:00)" },
        end_time: { type: "string" as const, description: "End time in HH:mm:ss format (e.g., 11:00:00)" },
        description: { type: "string" as const, description: "Brief reason for the meeting (a few words is fine, NO minimum word count)" },
      },
      required: ["name", "email", "date", "start_time", "end_time", "description"],
    },
  },
  {
    name: "checkBookingStatus",
    description: "Check the status of bookings by email address. Shows whether bookings are pending, accepted, rejected, etc.",
    parameters: {
      type: "object" as const,
      properties: { email: { type: "string" as const } },
      required: ["email"],
    },
  },
  {
    name: "searchPeople",
    description: "Search for other users by name or email to connect with them. If query is omitted or empty, it returns a general list of suggested users on the platform.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Optional name or email to search for" },
      },
    },
  },
  {
    name: "sendConnectionRequest",
    description: "Send a connection request to another user by their ID.",
    parameters: {
      type: "object" as const,
      properties: {
        receiver_id: { type: "string" as const, description: "The ID of the user to connect with" },
      },
      required: ["receiver_id"],
    },
  },
  {
    name: "getConnections",
    description: "Get the user's connections (pending, accepted, or rejected).",
    parameters: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const, description: "Optional filter by status: 'pending', 'accepted', 'rejected'. If omitted, returns all." },
      },
    },
  },
  {
    name: "getCurrentUser",
    description: "Get the profile details of the currently logged-in user (such as name, email, occupation). Use this when the user asks 'who am I?', 'what is my occupation?', or 'what is my profile?'.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "getPageOwner",
    description: "Get the profile details of the user whose schedule page the visitor is currently viewing (name, email, occupation). Use this when the visitor asks 'whose schedule is this?', 'who is the owner?', or 'what is the owner's occupation?'.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "navigateToPage",
    description: "Navigate/redirect the user to a specific page on the website. Use this when the user explicitly asks to go to a page (like '/dashboard', '/people', '/login', '/signup', or '/schedule/[userId]'), or gives permission to be redirected.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "The relative path to navigate to (e.g., '/people', '/dashboard', '/login', '/schedule/some-user-id')" },
      },
      required: ["path"],
    },
  },
  {
    name: "requestPasswordReset",
    description: "Request a password reset link for a user's email address. Use this when the user says they forgot their password, and you have confirmed their email address.",
    parameters: {
      type: "object" as const,
      properties: {
        email: { type: "string" as const, description: "The email address of the account to reset" },
      },
      required: ["email"],
    },
  },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { history, message, context } = body;

    // Try Gemini First if available
    let geminiFailed = false;
    if (genAI) {
      try {
        const PLATFORM_KNOWLEDGE = `# MyScheduler Platform Knowledge
## What is MyScheduler?
MyScheduler is a social scheduling platform where users can schedule meetings, view availability, and connect.
## Current Date: ${today()} (${dayName()})`;
        
        const ownerSystemInstruction = PLATFORM_KNOWLEDGE + "\n\nYour Role: You are a highly intelligent, conversational AI assistant on the OWNER'S DASHBOARD. Be natural and human-like in your responses (like ChatGPT/Claude). DO NOT use repetitive bullet points or robotic greetings. If the user says 'hi', respond naturally with a brief greeting. Use tools to manage schedule, respond to bookings, and answer questions. You can navigate the owner using the navigateToPage tool.";
        const visitorSystemInstruction = PLATFORM_KNOWLEDGE + "\n\nYour Role: You are a highly intelligent, conversational AI assistant for VISITORS. Be natural and human-like in your responses (like ChatGPT/Claude). DO NOT use repetitive bullet points or robotic greetings. If the user says 'hi', respond naturally with a brief greeting.\nTo book an appointment:\n1. When a user asks to book a slot, do NOT navigate them away unless explicitly asked. Instead, help them directly.\n2. First search for the host using the searchPeople tool.\n3. Use getAvailableSlots to find available times for the desired date.\n4. Ask the user for any missing details step-by-step: their name, email, date, time, and a brief reason for the meeting.\n5. Book the appointment directly using the bookAppointment tool. NEVER ask for a minimum word count for the reason (a short reason is perfectly fine).";
        
        const systemInstruction = context === "owner" ? ownerSystemInstruction : visitorSystemInstruction;
        const tools = context === "owner" ? OWNER_TOOLS : VISITOR_TOOLS;

        const contents = (history || []).map((msg: any) => {
          if (msg.role === "user") return { role: "user", parts: [{ text: msg.text || "" }] };
          if (msg.role === "model") {
            if (msg.functionCall) return { role: "model", parts: [{ functionCall: msg.functionCall }] };
            return { role: "model", parts: [{ text: msg.text || "" }] };
          }
          if (msg.role === "function") {
            return { role: "user", parts: [{ functionResponse: { name: msg.name, response: msg.response } }] };
          }
          return { role: "user", parts: [{ text: msg.text || "" }] };
        });

        if (message) {
          contents.push({ role: "user", parts: [{ text: message }] });
        }

        const modelsToTry = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-1.5-flash"];
        let response;
        for (const modelName of modelsToTry) {
          try {
            response = await genAI.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction,
                // @ts-ignore
                tools: [{ functionDeclarations: tools }],
              },
            });
            break;
          } catch (e: any) {
             if (modelName === modelsToTry[modelsToTry.length - 1]) throw e;
          }
        }
        
        if (response) {
          const call = response.functionCalls?.[0];
          if (call) {
            return NextResponse.json({
              type: "function_call",
              functionCall: { name: call.name, args: call.args },
            });
          }
          return NextResponse.json({
            type: "text",
            text: response.text || "I'm here to help!"
          });
        }
      } catch (geminiError: any) {
        console.warn("Gemini API failed, falling back to local engine:", geminiError);
        if (geminiError?.status === 429 || (geminiError?.message && (geminiError.message.toLowerCase().includes("quota") || geminiError.message.includes("429")))) {
            return NextResponse.json({
                type: "text",
                text: "⚠️ **Gemini API Quota Exceeded!** ⚠️\n\nI cannot give you an intelligent, ChatGPT-like response right now because the Google Gemini API key has exceeded its usage limit. \n\nPlease update the `GEMINI_API_KEY` in your `.env.local` file with a new key and restart your server (`npm run dev`) to restore my full intelligence!"
            });
        }
        geminiFailed = true;
      }
    } else {
       geminiFailed = true;
    }

    // If the last message in history is a function response, format it for the user in the local engine
    if (history && history.length > 0) {
      const lastMsg = history[history.length - 1];
      if (lastMsg.role === "function") {
        const formatted = formatFunctionResult(lastMsg.name, lastMsg.response);
        return NextResponse.json({
          type: "text",
          text: formatted,
        });
      }
    }

    // Try follow-up detection first
    let response = detectFollowUp(message || "", history || []);
    if (!response) {
      // Fallback to local intent detection
      const intent = detectIntent(message || "");
      response = context === "owner"
          ? buildOwnerResponse(intent, message || "", history || [])
          : buildVisitorResponse(intent, message || "", history || []);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again!" },
      { status: 500 }
    );
  }
}
