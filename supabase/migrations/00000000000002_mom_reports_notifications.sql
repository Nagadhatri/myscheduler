-- ========================================
-- MyScheduler v3 - MoM, Reports & Notifications
-- Run in your Supabase SQL Editor
-- ========================================

-- ========================================
-- Meeting Minutes Table
-- ========================================
CREATE TABLE IF NOT EXISTS public.meeting_minutes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual', -- 'manual' or 'voice'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- Reports Table
-- ========================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- Notifications Table
-- ========================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'booking_request', 'booking_accepted', 'booking_rejected', 'meeting_reminder', 'report_ready'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id TEXT, -- Optional: booking_id, schedule_id, report_id
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- Enable RLS
-- ========================================
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Meeting Minutes Policies
-- ========================================
CREATE POLICY "Users can view own meeting minutes"
ON public.meeting_minutes
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own meeting minutes"
ON public.meeting_minutes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own meeting minutes"
ON public.meeting_minutes
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own meeting minutes"
ON public.meeting_minutes
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ========================================
-- Reports Policies
-- ========================================
CREATE POLICY "Users can view own reports"
ON public.reports
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own reports"
ON public.reports
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- ========================================
-- Notifications Policies
-- ========================================
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- Add occupation column to profiles if not exists
-- ========================================
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS occupation TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
