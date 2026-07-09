import { GoogleGenAI } from '@google/genai';
const genAI = new GoogleGenAI({ apiKey: "invalid_key_to_force_error" });
async function test() {
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });
    console.log(response.text);
  } catch (error) {
    console.log("CAUGHT ERROR:", error.message);
    console.log("IS ERROR OBJECT?", error instanceof Error);
    console.log("KEYS:", Object.keys(error));
  }
}
test();
