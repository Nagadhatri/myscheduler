import { NextResponse } from "next/server";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import { GoogleGenAI } from "@google/genai";

/* ─────────────────────────────────────────────────────────
 *  Smart Local Chatbot Engine — NO external API needed
 *  Uses keyword-based intent detection + conversational
 *  flow to act as a highly intelligent tool-navigator.
 * ────────────────────────────────────────────────────────── */

// ── Helpers ──────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const dayName = () => new Date().toLocaleDateString("en-US", { weekday: "long" });


// ── Main API Handler ─────────────────────────────────────

const OWNER_TOOLS = [
  {
    name: "getTodaySchedule",
    description: "Get the owner's schedule for today or a specific date.",
    parameters: {
      type: "object" as const,
      properties: {
        date: { type: "string" as const, description: "Optional date in YYYY-MM-DD format. Defaults to today if not provided. You MUST silently convert natural words like 'tomorrow' or 'next monday' into this format yourself." },
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
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format. You MUST silently convert natural words like 'tomorrow' into this format yourself." },
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
        new_date: { type: "string" as const, description: "New date in YYYY-MM-DD format. You MUST silently convert natural words like 'tomorrow' into this format yourself." },
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
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format. You MUST silently convert natural words like 'tomorrow' or 'next monday' into this format yourself." },
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
        date: { type: "string" as const, description: "Date in YYYY-MM-DD format. You MUST silently convert natural words like 'tomorrow' or 'next monday' into this format yourself." },
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
    const customApiKey = req.headers.get("x-gemini-api-key");
    const customModel = req.headers.get("x-gemini-model");
    
    let client = genAI;
    if (customApiKey) {
      client = new GoogleGenAI({ apiKey: customApiKey });
    }

    const body = await req.json();
    const { history, message, context } = body;

    // Try Gemini First if available
    let geminiFailed = false;
    if (client) {
      try {
        const PLATFORM_KNOWLEDGE = `# MyScheduler Platform Knowledge
## What is MyScheduler?
MyScheduler is a social scheduling platform where users can schedule meetings, view availability, and connect.
## Current Date: ${today()} (${dayName()})`;
        
        const ownerSystemInstruction = PLATFORM_KNOWLEDGE + `

Your Role: You are a warm, witty, and highly intelligent general-purpose AI assistant on the OWNER'S DASHBOARD. Think of yourself as a trusted personal assistant, scheduler, and knowledge worker who has been working with this person for years.

CORE INTELLIGENCE & CAPABILITIES:
- **Reasoning & Problem Solving**: You can synthesize information, explain complex concepts, and provide stepwise guidance. Break down complex queries into logical steps.
- **Task Execution**: Beyond scheduling, you can draft emails, write code, generate quizzes, brainstorm ideas, or summarize texts.
- **Structured Outputs**: When appropriate, use Markdown tables, lists, JSON, and LaTeX math formatting (e.g. \`$E=mc^2$\`) to structure your data beautifully.
- **Creative & Content Generation**: You can write stories, poems, or code snippets in any programming language.

PERSONALITY & TONE ADAPTABILITY:
- Be conversational, natural, and human.
- **Adapt to the User**: Match the user's tone. If they are formal, be professional. If they are casual or technical, mirror their style.
- **Multilingual Support**: You MUST reply in the exact language the user speaks to you. If they speak Telugu, reply in Telugu. If they speak Telugish (Telugu in English script), reply in Telugish. If they speak English, reply in English. NEVER break this rule.
- Use contractions (I'll, you've, let's). Use light humor when appropriate. Be warm, not corporate.
- Keep responses concise unless the user asks for a detailed explanation or generation.
- Use emojis thoughtfully for engagement, not as decoration.

CONTEXT AWARENESS & MULTI-TURN DIALOGUE:
- Track conversation history flawlessly. Reference past turns and user preferences seamlessly.
- **Clarification**: If the user's request is vague or underspecified, ask ONE smart clarifying question instead of making assumptions.

INTEGRATION HOOKS (Scheduling):
- **CRITICAL**: NEVER tell the user to do scheduling tasks manually. Use your tools!
- If the user asks to accept/reject a booking, use 'respondToBooking'. If you don't know the booking ID, use 'queryBookings' first.
- If the user asks to cancel/delete a meeting, use 'deleteSlot'. If you don't know the slot ID, use 'getTodaySchedule' first.
- If the user asks to book a meeting with SOMEONE ELSE, you MUST use 'searchPeople' to find that person. Once found, offer to navigate the user to that person's schedule page to book it. If they agree, use 'navigateToPage' (e.g. \`/visit/[their_user_id]\`). DO NOT say you lack the tools to book it!
- You can weave tools into regular chat (e.g. drafting an email and booking a slot in the same breath).

SAFETY, RELIABILITY & BOUNDARIES:
- **Fact Checking**: Provide accurate, reliable information.
- **Boundaries**: Absolutely refuse to generate harmful, illegal, conspiratorial, or full-text copyrighted content.
- **Respectful Interaction**: Challenge distorted views politely, but never encourage harmful dependency.

ERROR HANDLING:
- If a tool fails, say it plainly and conversationally. Never expose raw JSON errors to the user.`;

        const visitorSystemInstruction = PLATFORM_KNOWLEDGE + `

Your Role: You are a highly intelligent, friendly, and capable general-purpose AI assistant for VISITORS viewing someone's schedule page. You act as a welcoming receptionist, but you are also a powerful AI ready to help with any task.

CORE INTELLIGENCE & CAPABILITIES:
- **Reasoning & Problem Solving**: Synthesize info, explain concepts, and provide stepwise guidance.
- **Task Execution**: You can draft emails, create events, generate quizzes, write code, or summarize documents.
- **Structured Outputs**: Use Markdown tables, lists, JSON, and LaTeX math formatting freely.
- **Creative & Content Generation**: You can write stories, poems, or brainstorm ideas.

PERSONALITY & TONE ADAPTABILITY:
- Be natural, human, and welcoming. Talk like a real person, not a customer service bot.
- **Adapt to the User**: Match their tone—formal, casual, or technical.
- **Multilingual Support**: You MUST reply in the exact language the user speaks to you. If they speak Telugu, reply in Telugu. If they speak Telugish (Telugu in English script), reply in Telugish. If they speak English, reply in English. NEVER break this rule.
- Keep it concise unless detailed output is requested.
- Use emojis thoughtfully to keep the interaction lively.

CONTEXT AWARENESS & MULTI-TURN DIALOGUE:
- Track conversation history and handle back-and-forth dialogue without losing context.
- **Clarification**: If input is vague ("I want to book"), ask ONE clarifying question ("Sure! Who do you want to book with?").

INTEGRATION HOOKS (Scheduling):
1. When a user wants to book, search for the host with 'searchPeople'.
2. Use 'getAvailableSlots' to find times for the desired date.
3. Collect details ONE at a time: name → email → reason. Don't dump all questions at once.
4. Book directly with 'bookAppointment'. A short reason like "catch up" is fine.
5. Never navigate them away unless they explicitly ask.

SAFETY, RELIABILITY & BOUNDARIES:
- **Fact Checking**: Use authoritative reasoning for accuracy.
- **Boundaries**: Avoid harmful, conspiratorial, or copyrighted full-text content. Refuse illegal requests.
- **Respectful**: Challenge distorted views politely.

ERROR HANDLING:
- If a tool fails, say it simply and suggest what to do next. Never show technical errors.`;
        
        const systemInstruction = context === "owner" ? ownerSystemInstruction : visitorSystemInstruction;
        const tools = context === "owner" ? OWNER_TOOLS : VISITOR_TOOLS;

        const contents = (history || []).map((msg: any) => {
          if (msg.role === "user") return { role: "user", parts: [{ text: msg.text || "" }] };
          if (msg.role === "model") {
            if (msg.functionCall) {
              const partToReturn: any = { functionCall: msg.functionCall };
              if (msg.thoughtSignature) {
                partToReturn.thoughtSignature = msg.thoughtSignature;
              }
              return { role: "model", parts: [partToReturn] };
            }
            return { role: "model", parts: [{ text: msg.text || "" }] };
          }
          if (msg.role === "function") {
            return { role: "user", parts: [{ functionResponse: { name: msg.name, response: msg.response } }] };
          }
          return { role: "user", parts: [{ text: msg.text || "" }] };
        });

        if (message && (!history || history.length === 0 || history[history.length - 1].text !== message)) {
          contents.push({ role: "user", parts: [{ text: message }] });
        }

        const modelToUse = customModel || "gemini-3.1-flash-lite";
        let response;
        try {
          response = await client.models.generateContent({
            model: modelToUse,
            contents,
            config: {
              systemInstruction,
              // @ts-ignore
              tools: [{ functionDeclarations: tools }],
            },
          });
        } catch (e: any) {
           throw e;
        }
        
        if (response) {
          const call = response.functionCalls?.[0];
          if (call) {
            const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall?.name === call.name);
            return NextResponse.json({
              type: "function_call",
              functionCall: call,
              thoughtSignature: part?.thoughtSignature || part?.thought_signature,
            });
          }
          
          if (response.text && response.text.trim().length > 0) {
            return NextResponse.json({
              type: "text",
              text: response.text
            });
          }
          // If empty text and no function call, fall through
          return NextResponse.json({
            type: "text",
            text: "I'm sorry, I couldn't process that request."
          });
        }
      } catch (geminiError: any) {
        console.error("Gemini API Error:", geminiError);
        const errorMessage = geminiError.message || "";
        
        let friendlyMessage = `🚨 **AI Engine Offline**\n\nI tried to connect to my Gemini AI brain, but your API Key seems to be invalid or there was an error. Please update the \`GEMINI_API_KEY\` in your \`.env.local\` file with a valid key from Google AI Studio.`;
        
        if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota")) {
          friendlyMessage = `🚨 **AI Quota Exceeded**\n\nI tried to connect to my Gemini AI brain, but you have exceeded your free tier quota limits. Please check your Google AI Studio billing details or wait a moment before trying again.`;
        }

        return NextResponse.json({
          type: "text",
          text: `${friendlyMessage}\n\nError Details: ${errorMessage}`
        });
      }
    } else {
      return NextResponse.json({
        type: "text",
        text: `🚨 **AI Engine Offline**\n\nI cannot wake up because the \`GEMINI_API_KEY\` is missing from your \`.env.local\` file! Please add it so I can start thinking.`
      });
    }


    return NextResponse.json({
      type: "text",
      text: "Sorry, an unexpected error occurred in the chat processing."
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again!" },
      { status: 500 }
    );
  }
}
