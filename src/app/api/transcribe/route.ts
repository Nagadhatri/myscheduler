import { NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";

export async function POST(req: Request) {
  if (!genAI) {
    return NextResponse.json(
      { error: "Gemini API key is missing. Cannot transcribe audio." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { audioData } = body;

    if (!audioData) {
      return NextResponse.json({ error: "No audio data provided." }, { status: 400 });
    }

    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: audioData,
                mimeType: "audio/webm",
              },
            },
            {
              text: "Transcribe the speech in this audio exactly as it was spoken. Output ONLY the raw transcribed text. Do not add any explanations, formatting, or translation. If it's Telugu, output Telugu script or Telglish depending on how it sounds. If it's Spanish, output Spanish. Just output the literal words spoken.",
            },
          ],
        },
      ],
    });

    const transcript = response.text?.trim() || "";

    return NextResponse.json({ transcript });
  } catch (error: any) {
    console.error("Transcription API Error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio. Please try again." },
      { status: 500 }
    );
  }
}
