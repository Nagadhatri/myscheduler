-- ========================================
-- MyScheduler v2 - Multi-User Schema
-- Run this AFTER the initial schema
-- in your Supabase SQL Editor
-- ========================================

-- Connection status enum
DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================================
-- Profiles Table
-- ========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- Connections Table
-- ========================================
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status connection_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(requester_id, receiver_id)
);

-- ========================================
-- Enable RLS
-- ========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Profile Policies
-- ========================================

-- Anyone authenticated can search/view profiles
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ========================================
-- Connection Policies
-- ========================================

-- Users can view connections they are part of
CREATE POLICY "Users can view own connections"
ON public.connections
FOR SELECT
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Users can send connection requests
CREATE POLICY "Users can send connection requests"
ON public.connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

-- Users can update connections they received (accept/reject)
CREATE POLICY "Receivers can update connection status"
ON public.connections
FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Users can delete connections they are part of
CREATE POLICY "Users can delete own connections"
ON public.connections
FOR DELETE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- ========================================
-- Update Schedule Policies for multi-user
-- ========================================

-- Drop old overly-permissive policies (run these one at a time if errors)
DROP POLICY IF EXISTS "Anyone can view schedules" ON public.schedules;
DROP POLICY IF EXISTS "Visitors can create schedule entries for bookings" ON public.schedules;

-- Schedules visible to owner OR accepted connections
CREATE POLICY "Schedules visible to owner or connections"
ON public.schedules
FOR SELECT
TO authenticated
USING (
    auth.uid() = owner_id
    OR EXISTS (
        SELECT 1 FROM public.connections
        WHERE status = 'accepted'
        AND (
            (requester_id = auth.uid() AND receiver_id = schedules.owner_id)
            OR (receiver_id = auth.uid() AND requester_id = schedules.owner_id)
        )
    )
);

-- Connected users can create schedule entries (for booking)
CREATE POLICY "Connected users can create schedules for booking"
ON public.schedules
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = owner_id
    OR true  -- Allow insert; booking flow creates schedule then booking
);

-- ========================================
-- Update Booking Policies for multi-user
-- ========================================
DROP POLICY IF EXISTS "Anyone can create a booking" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;

-- Authenticated users can create bookings (connection check done in app)
CREATE POLICY "Authenticated users can create bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can view bookings related to their schedules or their own bookings
CREATE POLICY "Users can view relevant bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
    -- Owner of the schedule
    EXISTS (
        SELECT 1 FROM public.schedules
        WHERE schedules.id = bookings.schedule_id
        AND schedules.owner_id = auth.uid()
    )
    -- Or visitor who made the booking (by checking if user email matches)
    OR visitor_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- ========================================
-- Auto-create profile on signup (trigger)
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if exists then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
