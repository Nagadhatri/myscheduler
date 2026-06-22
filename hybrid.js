const fs = require('fs');

const oldRoute = fs.readFileSync('old_route.ts', 'utf8');
const currentRoute = fs.readFileSync('src/app/api/chat/route.ts', 'utf8');

const geminiImports = 'import { genAI, GEMINI_MODEL } from "@/lib/gemini";\n';

const toolsMatch = oldRoute.match(/const OWNER_TOOLS = \[[\s\S]*?\];\n\nconst VISITOR_TOOLS = \[[\s\S]*?\];\n/);
const toolsCode = toolsMatch ? toolsMatch[0] : '';

// Remove 'export async function POST' from current route
const currentPostMatch = currentRoute.indexOf('export async function POST(req: Request) {');
const currentHelpersAndLocal = currentRoute.substring(0, currentPostMatch).replace('import { NextResponse } from "next/server";\n', '');

const hybridPost = `
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { history, message, context } = body;

    // Try Gemini First if available
    let geminiFailed = false;
    if (genAI) {
      try {
        const PLATFORM_KNOWLEDGE = \`# MyScheduler Platform Knowledge
## What is MyScheduler?
MyScheduler is a social scheduling platform where users can schedule meetings, view availability, and connect.
## Current Date: \${today()} (\${dayName()})\`;
        
        const ownerSystemInstruction = PLATFORM_KNOWLEDGE + "\\n\\nYour Role: You are the AI assistant on the OWNER'S DASHBOARD. Use tools to manage schedule and answer questions.";
        const visitorSystemInstruction = PLATFORM_KNOWLEDGE + "\\n\\nYour Role: You are the AI assistant for VISITORS. Help them find slots and book appointments using tools.";
        
        const systemInstruction = context === "owner" ? ownerSystemInstruction : visitorSystemInstruction;
        const tools = context === "owner" ? OWNER_TOOLS : VISITOR_TOOLS;

        const contents = (history || []).map((msg: any) => {
          if (msg.role === "user") return { role: "user", parts: [{ text: msg.text || "" }] };
          if (msg.role === "model") {
            if (msg.functionCall) return { role: "model", parts: [{ functionCall: msg.functionCall }] };
            return { role: "model", parts: [{ text: msg.text || "" }] };
          }
          if (msg.role === "function") {
            return { role: "user", parts: [{ functionResponse: { name: msg.name, response: msg.response } }] };
          }
          return { role: "user", parts: [{ text: msg.text || "" }] };
        });

        if (message) {
          contents.push({ role: "user", parts: [{ text: message }] });
        }

        const modelsToTry = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-1.5-flash"];
        let response;
        for (const modelName of modelsToTry) {
          try {
            response = await genAI.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction,
                tools: [{ functionDeclarations: tools }],
              },
            });
            break;
          } catch (e: any) {
             if (modelName === modelsToTry[modelsToTry.length - 1]) throw e;
          }
        }
        
        if (response) {
          const call = response.functionCalls?.[0];
          if (call) {
            return NextResponse.json({
              type: "function_call",
              functionCall: { name: call.name, args: call.args },
            });
          }
          return NextResponse.json({
            type: "text",
            text: response.text || "I'm here to help!"
          });
        }
      } catch (geminiError) {
        console.warn("Gemini API failed, falling back to local engine:", geminiError);
        geminiFailed = true;
      }
    } else {
       geminiFailed = true;
    }

    // Fallback to local intent detection
    const intent = detectIntent(message || "");
    const response = context === "owner"
        ? buildOwnerResponse(intent, message || "", history || [])
        : buildVisitorResponse(intent, message || "", history || []);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again!" },
      { status: 500 }
    );
  }
}
`;

const newFile = 'import { NextResponse } from "next/server";\n' + geminiImports + currentHelpersAndLocal + toolsCode + hybridPost;
fs.writeFileSync('src/app/api/chat/route.ts', newFile);
console.log('Hybrid route created.');
