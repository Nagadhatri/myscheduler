import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBusyTimes } from '@/lib/googleCalendar';

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const userId = urlObj.searchParams.get('userId');
  const startDate = urlObj.searchParams.get('startDate'); // e.g., 2026-07-23
  const endDate = urlObj.searchParams.get('endDate'); // e.g., 2026-07-30

  if (!userId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const supabase = await createClient();

  // We want to query from the start of startDate to the end of endDate
  const timeMin = new Date(startDate);
  const timeMax = new Date(endDate);
  timeMax.setDate(timeMax.getDate() + 1); // Add 1 day to cover the full end date

  const busyTimes = await getBusyTimes(supabase, userId, timeMin.toISOString(), timeMax.toISOString());

  return NextResponse.json({ busy: busyTimes });
}
