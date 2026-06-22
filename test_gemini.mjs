import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('c:/Users/nagad/myscheduler/.env.local') });

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PLATFORM_KNOWLEDGE = `# MyScheduler Platform Knowledge
## What is MyScheduler?
MyScheduler is a social scheduling platform where users can schedule meetings, view availability, and connect.
## Current Date: 2026-06-25 (Thursday)`;

const visitorSystemInstruction = PLATFORM_KNOWLEDGE + "\n\nYour Role: You are a highly intelligent, conversational AI assistant for VISITORS. Be natural and human-like in your responses (like ChatGPT/Claude). DO NOT use repetitive bullet points or robotic greetings. If the user says 'hi', respond naturally with a brief greeting.\nTo book an appointment:\n1. When a user asks to book a slot, do NOT navigate them away unless explicitly asked. Instead, help them directly.\n2. First search for the host using the searchPeople tool.\n3. Use getAvailableSlots to find available times for the desired date.\n4. Ask the user for any missing details step-by-step: their name, email, date, time, and a brief reason for the meeting.\n5. Book the appointment directly using the bookAppointment tool. NEVER ask for a minimum word count for the reason (a short reason is perfectly fine).";

async function test() {
  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      { role: 'user', parts: [{ text: 'I want to book an appointment' }] },
      { role: 'model', parts: [{ text: "I'd love to help you book an appointment! 📅 What **date** would you like to book? You can say things like: • \"Tomorrow\" • \"Next Monday\" • \"2026-06-25\" I'll then show you all the available time slots! ⏰" }] },
      { role: 'user', parts: [{ text: 'todau at 9.00pm with ritu' }] }
    ],
    config: {
      systemInstruction: visitorSystemInstruction,
    }
  });
  console.log("Model response:");
  console.log(response.text);
}

test();
