import { NextResponse } from "next/server";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";

export async function POST(req: Request) {
  if (!genAI) {
    return NextResponse.json(
      { error: "Gemini API key is missing. Cannot transcribe audio." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { audioData, mimeType } = body;
    const actualMimeType = mimeType || "audio/webm";

    if (!audioData) {
      return NextResponse.json({ error: "No audio data provided." }, { status: 400 });
    }

    // Try models in order. gemini-2.5-flash is the confirmed working model.
    const modelsToTry = [
      GEMINI_MODEL,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ];

    // Deduplicate
    const uniqueModels = [...new Set(modelsToTry)];

    let response;
    let lastError: any;
    for (const modelName of uniqueModels) {
      try {
        response = await genAI.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: audioData,
                    mimeType: actualMimeType,
                  },
                },
                {
                  text: "Transcribe the speech in this audio exactly as it was spoken. Output ONLY the raw transcribed text, nothing else. DO NOT use markdown formatting, DO NOT wrap the text in quotes, DO NOT output any labels like 'Transcript:'. Preserve the original language exactly. If the user speaks in Telugu, output in Telugu script. If Spanish, output Spanish. Just the literal spoken words.",
                },
              ],
            },
          ],
        });
        break;
      } catch (e: any) {
        lastError = e;
        console.warn(`Transcription model ${modelName} failed:`, e.message?.substring(0, 100));
        continue;
      }
    }

    if (!response) {
      throw lastError || new Error("All models failed");
    }

    const transcript = response.text?.trim() || "";

    return NextResponse.json({ transcript });
  } catch (error: any) {
    console.error("Transcription API Error:", error);
    return NextResponse.json(
      { error: `Transcription failed: ${error.message?.substring(0, 200)}` },
      { status: 500 }
    );
  }
}
