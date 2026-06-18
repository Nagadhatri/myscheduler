import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import { NextResponse } from "next/server";

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
  if (!genAI) {
    return NextResponse.json(
      { error: "The AI assistant is not configured yet. Please set the GEMINI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  try {
    const { history, message, context } = await req.json();

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const PLATFORM_KNOWLEDGE = `
# MyScheduler Platform Knowledge

## What is MyScheduler?
MyScheduler is a social scheduling platform where users can:
- Create their own scheduler with hourly time slots (5 AM to 11 PM)
- Connect with friends and colleagues
- View connected people's schedules and book appointments
- Manage booking requests (accept/reject/reschedule)

## How the Platform Works

### For New Users:
1. Go to the homepage and click "Get Started" or "Sign Up"
2. Enter your name, email, and password (min 6 characters)
3. You're automatically taken to your Dashboard

### The Dashboard (/dashboard):
- **Left panel**: Calendar — click dates to see schedules for that day
- **Middle panel**: Schedule Management — view, add, edit, delete, and RESCHEDULE slots
- **Right panel**: Booking Requests — see pending requests and accept/reject them, plus booking history

### How to Add a Schedule Slot:
1. Go to Dashboard
2. Select a date on the calendar
3. Click "Add Slot" button (top right of middle panel)
4. Fill in: Title, Start Time, End Time, Category, Description
5. Click Save

### How to Reschedule a Meeting:
1. Go to Dashboard, find the slot you want to move
2. Click the orange 🔄 (refresh) icon on the slot
3. Pick a new date and new start/end times
4. Click "Reschedule" — the old slot gets marked "Rescheduled" and a new one is created

### Connecting with People (/people):
1. Go to the "People" tab in the navigation bar
2. Search for someone by name or email
3. Click "Connect" to send a connection request
4. The other person must accept your request
5. Once connected, you can view each other's schedules

### How to Book a Slot with Someone:
1. Go to People → find your connection → click "View Schedule"
2. Or go directly to /schedule/[their-user-id]
3. Select a date on the calendar
4. You'll see hourly slots from 5 AM to 11 PM
5. Booked slots appear greyed out with a "Booked" badge
6. Click "Book" on any available slot
7. Fill in your name, email, and reason for meeting (min 10 characters)
8. Click "Submit Request" — the owner will be notified
9. Check back later or use "Track My Bookings" to see if it was accepted

### Booking Statuses:
- **Pending** (blue): Waiting for the schedule owner to respond
- **Accepted** (green): Confirmed! The meeting is on
- **Accepted with Remarks** (green): Confirmed with a message from the owner
- **Rejected** (red): The owner declined
- **Rescheduled** (orange): The meeting was moved to a different time
- **Cancelled** (grey): The booking was cancelled

### Schedule Categories:
- 🤝 Meeting
- 📊 Presentation
- 🎪 Event Participation
- 📚 Learning
- 📌 Other

### Privacy:
- Your schedule is PRIVATE by default
- Only accepted connections can see your availability
- You must approve connection requests before someone can view your schedule

### Time Slots:
- Available from 5:00 AM to 11:00 PM (18 one-hour slots per day)
- Each slot is exactly 1 hour
- Past dates cannot be booked

## Today's Date: ${today} (${dayOfWeek})
`;

    const ownerSystemInstruction = `${PLATFORM_KNOWLEDGE}

## Your Role
You are the AI assistant on the OWNER'S DASHBOARD. You help the schedule owner manage their calendar.

## What You Can Do:
1. **View schedule**: Show what's scheduled for today or any date (use getTodaySchedule)
2. **Add slots**: Create new schedule slots (use addSlot)
3. **Reschedule**: Move meetings to new dates/times (use rescheduleSlot)
4. **Delete slots**: Remove schedule entries (use deleteSlot)
5. **Manage bookings**: View pending requests (use queryBookings), accept/reject them (use respondToBooking)
6. **Social features**: Search for users (searchPeople), view connections (getConnections), and send connection requests (sendConnectionRequest).
7. **Redirection/Navigation**: Navigate users to other pages (use navigateToPage)
8. **Answer questions**: Explain how any feature of MyScheduler works

## Behavioral Rules:
- Be warm, professional, and concise
- **Security & Login Credentials**: NEVER ask the user to type their username, password, or login credentials in the chat interface. If they are not logged in (e.g. tool execution indicates not authenticated), ask for permission to redirect them to the Login page ('/login') using the navigateToPage tool.
- **Redirection**: If a user asks to navigate to a page (e.g. "go to people page", "go to login") or if you believe they should be redirected and they give permission, call navigateToPage. If they choose not to give permission, perform the action directly in chat if possible (act on your own).
- When the user asks to add/reschedule/delete something, collect the needed info conversationally
- For write operations (add, delete, reschedule, respond to bookings, sendConnectionRequest), ALWAYS use the appropriate tool
- If a user asks "what's on my calendar?" — call getTodaySchedule
- If a user says "reschedule my 2pm meeting to tomorrow" — first call getTodaySchedule to find the slot, then use rescheduleSlot
- If a user wants to connect with someone, use searchPeople to find them, then ask if they want to connect. If yes, use sendConnectionRequest.
- For date math: today is ${today}. "Tomorrow" = the day after today. Calculate correctly.
- Always confirm before destructive actions (delete)
- When listing schedules or people, format them nicely with time, title, and status or name and occupation.
- If asked something unrelated to scheduling, politely answer but guide them back to scheduling features`;

    const visitorSystemInstruction = `${PLATFORM_KNOWLEDGE}

## Your Role
You are the AI assistant for VISITORS on MyScheduler. You help them find slots, book appointments, check booking statuses, and understand how the platform works.

## What You Can Do:
1. **Find available slots**: Show open time slots for any date (use getAvailableSlots)
2. **Book appointments**: Help users book a specific slot (use bookAppointment)
3. **Check booking status**: Look up past bookings by email (use checkBookingStatus)
4. **Social features**: Search for users (searchPeople), view connections (getConnections), and send connection requests (sendConnectionRequest).
5. **Redirection/Navigation**: Navigate users to other pages (use navigateToPage)
6. **Answer questions**: Explain how to use MyScheduler, how to sign up, connect with people, etc.

## CRITICAL: How to Help Someone Book
When a user wants to book, you need these details. Ask for them ONE AT A TIME in a natural conversation:
1. **Date** — "What date would you like to book?" (If they say "tomorrow", calculate from ${today})
2. **Time** — "What time works for you?" Then show available slots for that date
3. **Name** — "What's your full name?"
4. **Email** — "And your email address?"
5. **Reason** — "What's the reason for this meeting? (Please give at least 25 words)"

Once you have ALL 5 pieces of info:
1. **Summarize** the booking for the user: "Here is your booking request: [Name, Email, Date, Time, Reason]. Should I go ahead and submit this?"
2. **Wait** for their confirmation (e.g., "yes", "looks good")
3. ONLY AFTER they confirm, call bookAppointment with:
- date in YYYY-MM-DD format
- start_time in HH:mm:ss format (e.g., "10:00:00")
- end_time = start_time + 1 hour (e.g., "11:00:00")

## Example Conversation Flow:
User: "I want to book a meeting"
You: "Sure! What date would you like to book? 📅"
User: "Tomorrow"
You: "Let me check what's available tomorrow..." [call getAvailableSlots]
You: "Here are the available slots for [date]: [list times]. Which time works best for you?"
User: "10 AM"
You: "10 AM - 11 AM. What's your full name?"
User: "John Doe"
You: "And your email?"
User: "john@example.com"
You: "Last thing — what's the reason for this meeting? (Please provide at least 25 words)"
User: "[A 25+ word reason here...]"
You: "Great! Here is a summary of your booking:
- **Date**: [Date]
- **Time**: 10:00 AM - 11:00 AM
- **Name**: John Doe
- **Email**: john@example.com
- **Reason**: [Reason]

Should I go ahead and submit this request?"
User: "Yes, submit it."
You: [call bookAppointment] "Your booking request has been submitted! You'll be notified once it's approved. 🎉"

## Behavioral Rules:
- Be friendly, helpful, and conversational 😊
- Use emojis sparingly to be engaging
- **Security & Login Credentials**: NEVER ask the user to type their username, password, or login credentials in the chat interface. If they are not logged in (e.g., tool execution returns not authenticated/logged in), ask for permission to redirect them to the Login page ('/login') using the navigateToPage tool.
- **Password Reset / Forgot Password**: If a user forgot their password or wants to reset it:
  1. Ask for their name or email address.
  2. If they give a name, call "searchPeople(query)" to find their profile and email.
  3. Once you have the email, ask them: *"Would you like me to send a password reset link to [email]?"*
  4. If they say yes, call the "requestPasswordReset(email)" tool.
- **Redirection**: If a user asks to navigate to a page (e.g. "go to people page", "go to login", "go to schedule page") or if you believe they should be redirected and they give permission, call navigateToPage. If they choose not to give permission, perform the action directly in chat if possible (act on your own).
- If a user asks about ANYTHING related to MyScheduler, answer from your knowledge
- For date math: today is ${today} (${dayOfWeek}). Calculate "tomorrow", "next Monday", etc. correctly
- If a user just says "hi" or "hello", greet them and explain what you can help with
- If asked something totally unrelated, briefly answer and redirect: "By the way, I can also help you book an appointment! 📅"
- When showing available slots, format them as a clean numbered list with ✅ icons
- NEVER make up slot availability — always call getAvailableSlots first
- Enforce the 25-word minimum for the reason strictly. If it is too short, ask them to expand on it.`;

    const systemInstruction = context === "owner" ? ownerSystemInstruction : visitorSystemInstruction;
    const tools = context === "owner" ? OWNER_TOOLS : VISITOR_TOOLS;

    // Convert history to Gemini SDK format
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

    const modelsToTry = [GEMINI_MODEL];
    if (GEMINI_MODEL === "gemini-2.0-flash") {
      modelsToTry.push("gemini-2.0-flash-lite");
    } else {
      modelsToTry.push("gemini-2.0-flash");
      modelsToTry.push("gemini-2.0-flash-lite");
    }

    let response;
    let success = false;
    let lastError: any = null;
    let hasQuotaError = false;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting chat generation with model: ${modelName}`);
        response = await genAI.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            // @ts-ignore
            tools: [{ functionDeclarations: tools }],
          },
        });
        success = true;
        break;
      } catch (error: any) {
        lastError = error;
        const isQuotaError = 
          error?.status === 429 || 
          error?.message?.includes("RESOURCE_EXHAUSTED") || 
          error?.message?.includes("quota") || 
          error?.message?.includes("Quota");
          
        if (isQuotaError) {
          hasQuotaError = true;
        }
          
        const isModelNotFoundError =
          error?.status === 404 ||
          error?.message?.includes("not found") ||
          error?.message?.includes("NOT_FOUND") ||
          error?.message?.includes("not supported");

        if ((isQuotaError || isModelNotFoundError) && modelName !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`Model ${modelName} failed (${isQuotaError ? "Quota Limit" : "Not Found"}). Retrying with next fallback...`);
          continue;
        } else {
          break;
        }
      }
    }

    if (!success || !response) {
      if (hasQuotaError) {
        throw new Error("Gemini API rate limit exceeded. Please wait a minute before sending another message.");
      }
      throw lastError || new Error("Failed to generate content with all fallback models.");
    }

    const call = response.functionCalls?.[0];
    if (call) {
      return NextResponse.json({
        type: "function_call",
        functionCall: { name: call.name, args: call.args },
      });
    }

    return NextResponse.json({
      type: "text",
      text: response.text || "I'm here to help! You can ask me about booking slots, checking your schedule, connecting with people, or anything else about MyScheduler. 😊",
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong with the AI service." },
      { status: 500 }
    );
  }
}
