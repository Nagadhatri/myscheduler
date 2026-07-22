-- ========================================
-- MyScheduler Database Update Script
-- (Fully Idempotent - Safe to run multiple times)
-- ========================================

-- ========================================
-- 1. Tables Creation
-- ========================================

CREATE TABLE IF NOT EXISTS public.meeting_minutes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- 2. Schema Additions
-- ========================================

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS occupation TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS buffer_time_mins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS meeting_types JSONB DEFAULT '[{"name": "15-minute Quick Sync", "duration_mins": 15}, {"name": "30-minute Standard", "duration_mins": 30}, {"name": "1-Hour Deep Dive", "duration_mins": 60}]'::jsonb;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS reschedule_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS email_reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meeting_type TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_token ON public.bookings(reschedule_token);

-- ========================================
-- 3. Row Level Security & Policies
-- ========================================

ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Safely drop existing policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Users can view own meeting minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Users can insert own meeting minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Users can update own meeting minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Users can delete own meeting minutes" ON public.meeting_minutes;

DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.reports;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can create a visitor profile" ON public.profiles;

DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can read their own bookings by token" ON public.bookings;

-- Re-create the policies
CREATE POLICY "Users can view own meeting minutes" ON public.meeting_minutes FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own meeting minutes" ON public.meeting_minutes FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own meeting minutes" ON public.meeting_minutes FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can delete own meeting minutes" ON public.meeting_minutes FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can delete own reports" ON public.reports FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Profile policies
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can create a visitor profile" ON public.profiles FOR INSERT WITH CHECK (true);

-- Booking policies
CREATE POLICY "Anyone can insert bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read their own bookings by token" ON public.bookings FOR SELECT USING (true);
