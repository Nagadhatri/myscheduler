import { GoogleGenAI } from '@google/genai';

// We initialize the client if the key is available
export const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
