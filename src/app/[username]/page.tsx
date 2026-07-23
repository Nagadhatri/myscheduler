import { createClient } from "@supabase/supabase-js";
import { redirect, notFound } from "next/navigation";

export default async function UsernameRedirectPage({ params }: { params: { username: string } }) {
  const decodedUsername = decodeURIComponent(params.username);
  
  // Skip obvious non-usernames to prevent matching static routes if NextJS falls through
  const reservedWords = ['favicon.ico', 'api', 'dashboard', 'login', 'signup', 'schedule', 'reschedule', '_next', 'robots.txt'];
  if (reservedWords.includes(decodedUsername.toLowerCase())) {
    return notFound();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // First try to match by display_name
  let { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", decodedUsername)
    .limit(1)
    .maybeSingle();

  // If not found, check if the "username" is actually just a UUID being passed
  if (!data) {
     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
     if (uuidRegex.test(decodedUsername)) {
         const { data: uuidData } = await supabase.from("profiles").select("id").eq("id", decodedUsername).maybeSingle();
         if (uuidData) {
             data = uuidData;
         }
     }
  }

  if (data && data.id) {
    redirect(`/schedule/${data.id}`);
  }

  return notFound();
}
