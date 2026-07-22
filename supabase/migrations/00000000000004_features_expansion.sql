-- ========================================
-- MyScheduler Feature Expansion Migration
-- ========================================

-- 1. Update Profiles Table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS buffer_time_mins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS meeting_types JSONB DEFAULT '[{"name": "15-minute Quick Sync", "duration_mins": 15}, {"name": "30-minute Standard", "duration_mins": 30}, {"name": "1-Hour Deep Dive", "duration_mins": 60}]'::jsonb;

-- 2. Update Bookings Table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS reschedule_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS email_reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meeting_type TEXT;

-- Create an index for reschedule_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_token ON public.bookings(reschedule_token);
