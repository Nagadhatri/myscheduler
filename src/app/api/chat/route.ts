import { streamText, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow long running streams

const OWNER_TOOLS = {
  getTodaySchedule: tool({
    description: "Get the owner's schedule for today or a specific date.",
    parameters: z.object({
      date: z.string().optional().describe("Optional date in YYYY-MM-DD format. Defaults to today if not provided. You MUST silently convert natural words like 'tomorrow' or 'next monday' into this format yourself."),
    }),
  } as any),
  queryBookings: tool({
    description: "Query pending booking requests that need action, or all bookings.",
    parameters: z.object({
      status: z.string().optional().describe("Filter by status: 'Pending', 'Accepted', 'Rejected', or 'all'. Defaults to 'Pending'."),
    }),
  } as any),
  addSlot: tool({
    description: "Add a new schedule slot to the owner's calendar.",
    parameters: z.object({
      title: z.string(),
      date: z.string().describe("Date in YYYY-MM-DD format. You MUST silently convert natural words like 'tomorrow' into this format yourself."),
      start_time: z.string().describe("Start time in HH:mm format"),
      end_time: z.string().describe("End time in HH:mm format"),
      category: z.enum(["Meeting", "Presentation", "Event Participation", "Learning", "Other"]),
      description: z.string().optional().describe("Optional description"),
    }),
  } as any),
  deleteSlot: tool({
    description: "Delete a specific schedule slot by ID.",
    parameters: z.object({
      id: z.string().describe("The ID of the slot to delete"),
    }),
  } as any),
  rescheduleSlot: tool({
    description: "Reschedule an existing slot to a new time.",
    parameters: z.object({
      slot_id: z.string().describe("The ID of the slot to reschedule"),
      new_date: z.string().describe("New date in YYYY-MM-DD format"),
      new_start_time: z.string().describe("New start time in HH:mm format"),
      new_end_time: z.string().describe("New end time in HH:mm format"),
      reason: z.string().optional().describe("Optional reason for rescheduling"),
    }),
  } as any),
  respondToBooking: tool({
    description: "Accept, reject, or add remarks to a pending booking request.",
    parameters: z.object({
      booking_id: z.string(),
      action: z.enum(["Accepted", "Accepted with Remarks", "Rejected"]),
      remarks: z.string().optional().describe("Optional message to send to the visitor"),
    }),
  } as any),
  searchPeople: tool({
    description: "Search for other users by name or email to connect with them.",
    parameters: z.object({
      query: z.string().optional().describe("Optional name or email to search for"),
    }),
  } as any),
  sendConnectionRequest: tool({
    description: "Send a connection request to another user by their ID.",
    parameters: z.object({
      receiver_id: z.string().describe("The ID of the user to connect with"),
    }),
  } as any),
  getConnections: tool({
    description: "Get the user's connections (pending, accepted, or rejected).",
    parameters: z.object({
      status: z.string().optional().describe("Optional filter by status: 'pending', 'accepted', 'rejected'. If omitted, returns all."),
    }),
  } as any),
  getCurrentUser: tool({
    description: "Get the profile details of the currently logged-in user (such as name, email, occupation).",
    parameters: z.object({}),
  } as any),
  navigateToPage: tool({
    description: "Navigate/redirect the user to a specific page on the website.",
    parameters: z.object({
      path: z.string().describe("The relative path to navigate to (e.g., '/people', '/dashboard', '/login', '/schedule/some-user-id')"),
    }),
  } as any),
  generateReport: tool({
    description: "Generate a summary report of bookings, slots, or user activity.",
    parameters: z.object({
      reportType: z.enum(["bookings", "activity"]),
      dateFrom: z.string().describe("Start date"),
      dateTo: z.string().describe("End date"),
    }),
  } as any),
  getMeetingMinutes: tool({
    description: "Retrieve generated meeting minutes for a past schedule slot.",
    parameters: z.object({
      slot_id: z.string().describe("The ID of the past schedule slot"),
    }),
  } as any),
};

const VISITOR_TOOLS = {
  checkBookingStatus: tool({
    description: "Check the status of an existing booking request.",
    parameters: z.object({
      email: z.string().describe("The visitor's email address.")
    }),
  } as any),
  getAvailableSlots: tool({
    description: "Get the owner's available slots for a specific date.",
    parameters: z.object({
      date: z.string().describe("Date in YYYY-MM-DD format to check availability."),
      owner_id: z.string().optional().describe("The ID of the page owner."),
    }),
  } as any),
  bookAppointment: tool({
    description: "Submit a booking request for an available slot.",
    parameters: z.object({
      date: z.string().describe("Date in YYYY-MM-DD format"),
      start_time: z.string().describe("Start time in HH:mm format"),
      end_time: z.string().describe("End time in HH:mm format"),
      name: z.string().describe("Visitor's full name"),
      email: z.string().describe("Visitor's email address"),
      description: z.string().optional().describe("Optional purpose of the meeting"),
      owner_id: z.string().optional().describe("The ID of the page owner."),
    }),
  } as any),
  requestPasswordReset: tool({
    description: "Trigger a password reset email if the user forgot their password.",
    parameters: z.object({
      email: z.string().describe("The user's email address"),
    }),
  } as any),
  getPageOwner: tool({
    description: "Get basic public information about the owner of the current page.",
    parameters: z.object({}),
  } as any),
  navigateToPage: tool({
    description: "Navigate/redirect the user to a specific page on the website.",
    parameters: z.object({
      path: z.string().describe("The relative path to navigate to (e.g., '/people', '/dashboard', '/login', '/schedule/some-user-id')"),
    }),
  } as any),
};

export async function POST(req: Request) {
  try {
    const customApiKey = req.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY;
    let customModel = "gemini-1.5-flash"; // Hardcoded to fix thought_signature issue
    
    const body = await req.json();
    const { messages, context, urlPath, clientData } = body;
    
    if (!customApiKey) {
      return NextResponse.json({ error: "Gemini API key is required" }, { status: 401 });
    }

    const google = createGoogleGenerativeAI({
      apiKey: customApiKey,
    });

    const PLATFORM_KNOWLEDGE = `# MyScheduler Platform Knowledge
## What is MyScheduler?
MyScheduler is an advanced Next.js & Supabase scheduling application. It supports distinct profiles, social connections, and direct slot booking.

## Modes of Operation
You are operating in "${context}" mode.
- Owner mode: You manage the user's schedule, bookings, and connections.
- Visitor mode: You are embedded on a user's page to help visitors book meetings.
`;

    const ownerSystemInstruction = `${PLATFORM_KNOWLEDGE}
You are the personal AI Assistant (Smart Navigator) for the logged-in owner.
- You can manage their calendar (add/delete/reschedule slots).
- You can view pending bookings and accept/reject them.
- You can search for other people to connect with.
- You can generate analytical reports.
- You are autonomous: use your tools to accomplish tasks, and immediately use follow-up tools if necessary.
- Be concise.
`;

    const visitorSystemInstruction = `${PLATFORM_KNOWLEDGE}
You are an intelligent booking assistant representing the owner of this page.
- The visitor wants to book a time with the owner or find out more about them.
- Look up available slots and help the visitor submit a booking request.
- Ensure all dates are in YYYY-MM-DD format when calling tools.
- Be polite, concise, and helpful.
`;

    const baseSystemInstruction = context === "owner" ? ownerSystemInstruction : visitorSystemInstruction;
    
    // RAG Context Awareness
    const ragContext = `
ADDITIONAL CONTEXT:
User's current URL: ${urlPath}
Active Screen Data: ${JSON.stringify(clientData || {})}
    `;

    const systemInstruction = baseSystemInstruction + "\n\n" + ragContext;
    const activeTools = context === "owner" ? OWNER_TOOLS : VISITOR_TOOLS;

    // Use AI SDK streamText
    const result = streamText({
      model: google(customModel),
      messages,
      system: systemInstruction,
      tools: activeTools as any, // Cast tools as any to fix Zod typing issues with old Vercel AI SDK vs new Zod
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
  }
}
