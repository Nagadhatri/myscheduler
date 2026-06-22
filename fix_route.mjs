import fs from 'fs';
import path from 'path';

const file = 'c:/Users/nagad/myscheduler/src/app/api/chat/route.ts';
let code = fs.readFileSync(file, 'utf8');

const replacement = `const OWNER_TOOLS = [
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

export async function POST(req: Request) {`;

// The mangled mess starts around "// ── Main API Handler ─────────────────────────────────────"
// and ends right before "export async function POST(req: Request) {"
const startMarker = "// ── Main API Handler ─────────────────────────────────────";
const endMarker = "export async function POST(req: Request) {";

const startIndex = code.indexOf(startMarker);
const endIndex = code.lastIndexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const before = code.substring(0, startIndex + startMarker.length + 1);
  const after = code.substring(endIndex + endMarker.length);
  code = before + "\\n" + replacement + after;
  fs.writeFileSync(file, code);
  console.log("Fixed route.ts!");
} else {
  console.error("Could not find markers!");
}
