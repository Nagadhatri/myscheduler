-- ========================================
-- MyScheduler Database Schema
-- Run this in your Supabase SQL Editor
-- ========================================

-- Create enum for schedule categories
DO $$ BEGIN
  CREATE TYPE schedule_category AS ENUM (
    'Meeting',
    'Presentation',
    'Event Participation',
    'Learning',
    'Other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for schedule statuses
DO $$ BEGIN
  CREATE TYPE schedule_status AS ENUM (
    'Upcoming',
    'Completed',
    'Rescheduled',
    'Cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for booking statuses
DO $$ BEGIN
  CREATE TYPE booking_status_type AS ENUM (
    'Pending',
    'Accepted',
    'Accepted with Remarks',
    'Rejected',
    'Cancelled',
    'Rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Schedules Table
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category schedule_category NOT NULL DEFAULT 'Other',
    description TEXT,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status schedule_status NOT NULL DEFAULT 'Upcoming',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    visitor_name TEXT NOT NULL,
    visitor_email TEXT NOT NULL,
    description TEXT,
    booking_status booking_status_type NOT NULL DEFAULT 'Pending',
    owner_remarks TEXT,
    action_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Schedule Policies
-- ========================================

-- Owner can manage their own schedules
CREATE POLICY "Owners can manage their own schedules"
ON public.schedules
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Anyone can view schedules (for the visitor page)
CREATE POLICY "Anyone can view schedules"
ON public.schedules
FOR SELECT
TO anon, authenticated
USING (true);

-- Visitors (anon) can INSERT schedules (needed when auto-generated slots are booked)
CREATE POLICY "Visitors can create schedule entries for bookings"
ON public.schedules
FOR INSERT
TO anon
WITH CHECK (true);

-- ========================================
-- Booking Policies
-- ========================================

-- Owner can manage bookings for their schedules
CREATE POLICY "Owners can manage bookings for their schedules"
ON public.bookings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.schedules
        WHERE schedules.id = bookings.schedule_id
        AND schedules.owner_id = auth.uid()
    )
);

-- Anyone can create a booking
CREATE POLICY "Anyone can create a booking"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anyone can view bookings (filtered by email in app code)
CREATE POLICY "Anyone can view bookings"
ON public.bookings
FOR SELECT
TO anon, authenticated
USING (true);
