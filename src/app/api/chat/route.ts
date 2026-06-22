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
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
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

  // Greetings
  if (/^(hi|hello|hey|howdy|yo|what's up|good morning|good evening|good afternoon|greetings)\b/.test(t))
    return "greeting";

  // Help
  if (/\b(help|what can you do|how do i|how does|guide|tutorial|explain|instructions)\b/.test(t))
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

  // Book
  if (/\b(book|schedule.*meeting|schedule.*appointment|reserve|make.*appointment|set.*meeting|need.*slot)\b/.test(t))
    return "book_slot";

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
        text: `Hello! 👋 Welcome to your Dashboard.\n\nI'm your AI scheduling assistant. Here's what I can help you with:\n\n📅 **View your schedule** — "What's on my calendar today?"\n➕ **Add time slots** — "Add a meeting tomorrow at 3 PM"\n🔄 **Reschedule meetings** — "Move my 2 PM meeting to Thursday"\n📋 **Manage booking requests** — "Show me pending bookings"\n👥 **Find & connect with people** — "Find John"\n🔍 **Navigate the platform** — "Go to People page"\n\nWhat would you like to do?`,
      };

    case "help":
      return {
        type: "text",
        text: `Sure! Here's everything I can do for you:\n\n**📅 Schedule Management:**\n• View your schedule for any date\n• Add new time slots with title, category & time\n• Reschedule existing meetings\n• Delete slots you no longer need\n\n**📋 Booking Management:**\n• View pending booking requests\n• Accept or reject bookings\n• Add remarks when accepting\n\n**👥 Social Features:**\n• Search for people by name or email\n• Send connection requests\n• View your connections\n\n**🧭 Navigation:**\n• Navigate to any page on the platform\n\nJust tell me what you need! 😊`,
      };

    case "view_schedule": {
      const date = resolveDate(text) || today();
      return {
        type: "function_call",
        functionCall: { name: "getTodaySchedule", args: { date } },
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
      const query = text.replace(/\b(find|search|look\s*for|discover|people|user|person|someone|please|can you|for|about)\b/gi, "").trim();
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
        text: `I'm here to help you manage your schedule! 😊\n\nTry asking me things like:\n• "What's on my calendar today?"\n• "Add a slot tomorrow at 10 AM"\n• "Show me pending bookings"\n• "Find someone named Ritu"\n• "Go to People page"\n\nWhat would you like to do?`,
      };
  }
}

function buildVisitorResponse(intent: Intent, text: string, history: any[]): any {
  const t = text.toLowerCase();

  switch (intent) {
    case "greeting":
      return {
        type: "text",
        text: `Hello! 👋 Welcome to MyScheduler!\n\nI'm your booking assistant. Here's how I can help:\n\n📅 **Book an appointment** — "I want to book a meeting tomorrow at 10 AM"\n🔍 **Check available slots** — "Show me available slots for today"\n📋 **Track your bookings** — "Check my booking status"\n👥 **Find people** — "Search for John"\n🧭 **Navigate** — "Go to People page"\n\nWhat would you like to do?`,
      };

    case "help":
      return {
        type: "text",
        text: `Here's everything I can help you with! 🌟\n\n**📅 Booking:**\n• Find available time slots for any date\n• Book an appointment (I'll guide you step-by-step!)\n• Check the status of your existing bookings\n\n**👥 Social:**\n• Search for people by name or email\n• Send connection requests\n• View your connections\n\n**🧭 Navigation:**\n• Go to any page — Dashboard, People, Login, etc.\n\n**🔑 Account Help:**\n• Reset your password if you forgot it\n\nJust ask away! 😊`,
      };

    case "book_slot": {
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
      const query = text.replace(/\b(find|search|look\s*for|discover|people|user|person|someone|please|can you|for|about)\b/gi, "").trim();
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
        text: `I'm here to help you navigate MyScheduler! 😊\n\nTry asking me:\n• "I want to book an appointment"\n• "Show available slots for tomorrow"\n• "Check my booking status"\n• "Find someone named Ritu"\n• "How do I sign up?"\n\nWhat would you like to do?`,
      };
  }
}

// ── Follow-up Detection (conversational context) ─────────
function detectFollowUp(text: string, history: any[]): any | null {
  const t = text.toLowerCase().trim();
  if (history.length === 0) return null;

  const lastBotMsg = [...history].reverse().find((m: any) => m.role === "model" && m.text);
  const lastBotText = lastBotMsg?.text?.toLowerCase() || "";

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
      text: `Great choice! ⏰ **${formatTimeReadable(time)}** is selected.\n\nTo complete the booking, I need a few more details:\n1. **Your full name**\n2. **Your email address**\n3. **Reason for the meeting** (at least 25 words)\n\nWhat's your full name?`,
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
      text: `Here's how to book an appointment! 📅\n\n1. **Find the person** you want to book with:\n   • Go to **People** page → search by name/email → send a **Connect** request\n   • Wait for them to **accept** your connection\n2. Once connected, click **View Schedule** on their profile\n3. **Pick a date** on the calendar\n4. Browse the **available time slots**\n5. Click **Book** on your preferred slot\n6. Fill in your **name, email, and reason** (min 25 words)\n7. Submit! The owner will review and accept/reject your request ✅\n\nOr just tell me *"I want to book a slot"* and I'll guide you through it right here! 😊`,
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
      const lines = users.map((u: any) => `• **${u.display_name || "User"}** — ${u.occupation || "N/A"} (${u.email})`);
      return `🔍 **Search Results:**\n\n${lines.join("\n")}\n\nWould you like to connect with any of them? Or view their schedule?`;
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
        description: { type: "string" as const, description: "Reason for the meeting (must be at least 25 words)" },
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
        
        const ownerSystemInstruction = PLATFORM_KNOWLEDGE + "\n\nYour Role: You are the AI assistant on the OWNER'S DASHBOARD. Use tools to manage schedule and answer questions.";
        const visitorSystemInstruction = PLATFORM_KNOWLEDGE + "\n\nYour Role: You are the AI assistant for VISITORS. Help them find slots and book appointments using tools.";
        
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
      } catch (geminiError) {
        console.warn("Gemini API failed, falling back to local engine:", geminiError);
        geminiFailed = true;
      }
    } else {
       geminiFailed = true;
    }

    // Fallback to local intent detection
    const intent = detectIntent(message || "");
    const response = context === "owner"
        ? buildOwnerResponse(intent, message || "", history || [])
        : buildVisitorResponse(intent, message || "", history || []);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again!" },
      { status: 500 }
    );
  }
}
