import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import { NextResponse } from "next/server";

const OWNER_TOOLS = [
  {
    name: "getTodaySchedule",
    description: "Get the owner's schedule for today.",
    parameters: { type: "object" as const, properties: {} },
  },
  {
    name: "queryBookings",
    description: "Query all pending bookings that need action.",
    parameters: { type: "object" as const, properties: {} },
  },
  {
    name: "addSlot",
    description: "Add a new custom schedule slot.",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const },
        date: { type: "string" as const, description: "YYYY-MM-DD format" },
        start_time: { type: "string" as const, description: "HH:mm format" },
        end_time: { type: "string" as const, description: "HH:mm format" },
        category: {
          type: "string" as const,
          enum: [
            "Meeting",
            "Presentation",
            "Event Participation",
            "Learning",
            "Other",
          ],
        },
      },
      required: ["title", "date", "start_time", "end_time", "category"],
    },
  },
  {
    name: "deleteSlot",
    description: "Delete a schedule slot by ID.",
    parameters: {
      type: "object" as const,
      properties: { id: { type: "string" as const } },
      required: ["id"],
    },
  },
];

const VISITOR_TOOLS = [
  {
    name: "getAvailableSlots",
    description:
      "Get available 1-hour slots for a specific date between 5 AM and 11 PM. Returns time slots that are not yet booked.",
    parameters: {
      type: "object" as const,
      properties: {
        date: {
          type: "string" as const,
          description: "Date in YYYY-MM-DD format",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "bookAppointment",
    description:
      "Book an appointment at a specific time. Creates a booking request that the owner will review. You need the visitor name, email, date, start_time (HH:mm:ss), end_time (HH:mm:ss), and a description/reason.",
    parameters: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "Visitor's full name",
        },
        email: {
          type: "string" as const,
          description: "Visitor's email address",
        },
        date: {
          type: "string" as const,
          description: "Date in YYYY-MM-DD format",
        },
        start_time: {
          type: "string" as const,
          description: "Start time in HH:mm:ss format",
        },
        end_time: {
          type: "string" as const,
          description: "End time in HH:mm:ss format",
        },
        description: {
          type: "string" as const,
          description: "Reason for the meeting",
        },
      },
      required: [
        "name",
        "email",
        "date",
        "start_time",
        "end_time",
        "description",
      ],
    },
  },
  {
    name: "checkBookingStatus",
    description: "Check the status of past bookings by email address.",
    parameters: {
      type: "object" as const,
      properties: { email: { type: "string" as const } },
      required: ["email"],
    },
  },
];

export async function POST(req: Request) {
  if (!genAI) {
    return NextResponse.json(
      { error: "Gemini API key not configured. Please set GEMINI_API_KEY." },
      { status: 500 }
    );
  }

  try {
    const { history, message, context } = await req.json();

    const today = new Date().toISOString().split("T")[0];
    const systemInstruction =
      context === "owner"
        ? `You are the AI assistant for the Owner of MyScheduler. Today is ${today}. You can view schedules, add slots, delete slots, and check bookings. Use tools to answer data questions. Be concise and helpful.`
        : `You are the AI assistant for visitors on MyScheduler. Today is ${today}. Available slots are hourly from 5 AM (05:00) to 11 PM (23:00). Help visitors:
1. Find available slots on a date (use getAvailableSlots)
2. Book appointments (use bookAppointment - ask for name, email, preferred date/time, and reason first)
3. Check booking status (use checkBookingStatus)

When booking: if a visitor says "tomorrow at 10 AM", calculate the correct date from today (${today}), and set start_time to "10:00:00" and end_time to "11:00:00". Always ask for their name, email, and reason before booking. Be friendly and conversational!`;

    const tools = context === "owner" ? OWNER_TOOLS : VISITOR_TOOLS;

    // Convert history to Gemini SDK format
    const contents = (history || []).map((msg: any) => {
      if (msg.role === "user")
        return { role: "user", parts: [{ text: msg.text || "" }] };
      if (msg.role === "model") {
        if (msg.functionCall) {
          return {
            role: "model",
            parts: [{ functionCall: msg.functionCall }],
          };
        }
        return { role: "model", parts: [{ text: msg.text || "" }] };
      }
      if (msg.role === "function") {
        return {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: msg.response,
              },
            },
          ],
        };
      }
      return { role: "user", parts: [{ text: msg.text || "" }] };
    });

    if (message) {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        // @ts-ignore - SDK types don't perfectly match but this works
        tools: [{ functionDeclarations: tools }],
      },
    });

    const call = response.functionCalls?.[0];
    if (call) {
      return NextResponse.json({
        type: "function_call",
        functionCall: { name: call.name, args: call.args },
      });
    }

    return NextResponse.json({
      type: "text",
      text: response.text || "I'm not sure how to help with that. Try asking about available slots or booking an appointment!",
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong with the AI service." },
      { status: 500 }
    );
  }
}
