import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Use service role key if available to bypass RLS, otherwise fallback to anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    if (!supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ users: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
