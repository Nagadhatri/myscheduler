import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import { NextResponse } from "next/server";

const OWNER_TOOLS = [{
  name: "getTodaySchedule",
  description: "Get the owner's schedule for today.",
  parameters: { type: "object", properties: {} }
}, {
  name: "queryBookings",
  description: "Query pending or all bookings.",
  parameters: { type: "object", properties: {} }
}, {
  name: "addSlot",
  description: "Add a new schedule slot.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      start_time: { type: "string", description: "HH:mm" },
      end_time: { type: "string", description: "HH:mm" },
      category: { type: "string", enum: ["Meeting", "Presentation", "Event Participation", "Learning", "Other"] }
    },
    required: ["title", "date", "start_time", "end_time", "category"]
  }
}, {
  name: "deleteSlot",
  description: "Delete a schedule slot by ID.",
  parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
}];

const VISITOR_TOOLS = [{
  name: "getAvailableSlots",
  description: "Get available slots for a specific date.",
  parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] }
}, {
  name: "bookAppointment",
  description: "Book an appointment for an available slot.",
  parameters: {
    type: "object",
    properties: {
      schedule_id: { type: "string" },
      name: { type: "string" },
      email: { type: "string" },
      description: { type: "string" }
    },
    required: ["schedule_id", "name", "email", "description"]
  }
}, {
  name: "checkBookingStatus",
  description: "Check the status of past bookings by email.",
  parameters: { type: "object", properties: { email: { type: "string" } }, required: ["email"] }
}];

export async function POST(req: Request) {
  if (!genAI) {
    return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
  }

  try {
    const { history, message, context } = await req.json();

    const systemInstruction = context === "owner" 
      ? "You are the AI assistant for the Owner of MyScheduler. You can view schedules, add slots, delete slots, and check bookings. You MUST use tools to answer questions. If a tool requires confirmation, inform the user."
      : "You are the AI assistant for a Visitor on MyScheduler. You can help them find available slots, book an appointment, and check their past booking status. Ask for necessary details before calling tools.";

    const tools = context === "owner" ? OWNER_TOOLS : VISITOR_TOOLS;

    // We use the simpler generateContent method handling history manually or using chats.
    // The @google/genai SDK has a `chats` service.
    const chat = genAI.chats.create({
      model: GEMINI_MODEL,
      config: {
        systemInstruction,
        // @ts-ignore
        tools: [{ functionDeclarations: tools }],
      }
    });

    // Replay history if possible, but the SDK's chat.sendMessage is stateful on the object.
    // To properly support stateless HTTP, we either reconstruct the history or just pass the whole conversation as contents.
    // For simplicity, we can pass contents array to `genAI.models.generateContent`.
    
    // Convert generic history to SDK format
    const contents = history.map((msg: any) => {
      if (msg.role === 'user') return { role: 'user', parts: [{ text: msg.text }] };
      if (msg.role === 'model') {
        if (msg.functionCall) {
          return { role: 'model', parts: [{ functionCall: msg.functionCall }] };
        }
        return { role: 'model', parts: [{ text: msg.text }] };
      }
      if (msg.role === 'function') {
        return { role: 'user', parts: [{ functionResponse: { name: msg.name, response: msg.response } }] };
      }
      return { role: 'user', parts: [{ text: msg.text }] };
    });

    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        // @ts-ignore
        tools: [{ functionDeclarations: tools }],
      }
    });

    const call = response.functionCalls?.[0];
    if (call) {
      return NextResponse.json({
        type: "function_call",
        functionCall: { name: call.name, args: call.args }
      });
    }

    return NextResponse.json({
      type: "text",
      text: response.text
    });

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
