import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Helper to get anon key even if dev server hasn't been restarted
function getAnonKey() {
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (e) {
    // ignore
  }
  return "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = getAnonKey();
    
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ users: [] });
    }

    const supabase = createClient(supabaseUrl, anonKey);

    if (query) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, occupation")
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      return NextResponse.json({ users: data || [] });
    }

    return NextResponse.json({ users: [] });
  } catch (error: any) {
    console.error("Search people API error:", error);
    return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }
}
