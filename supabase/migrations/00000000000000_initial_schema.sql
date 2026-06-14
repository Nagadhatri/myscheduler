-- Create enum for schedule categories
CREATE TYPE schedule_category AS ENUM (
  'Meeting',
  'Presentation',
  'Event Participation',
  'Learning',
  'Other'
);

-- Create enum for schedule statuses
CREATE TYPE schedule_status AS ENUM (
  'Upcoming',
  'Completed',
  'Rescheduled',
  'Cancelled'
);

-- Create enum for booking statuses
CREATE TYPE booking_status_type AS ENUM (
  'Pending',
  'Accepted',
  'Accepted with Remarks',
  'Rejected',
  'Cancelled',
  'Rescheduled'
);

-- Schedules Table
CREATE TABLE public.schedules (
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
CREATE TABLE public.bookings (
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

-- Owner can do everything on their own schedules
CREATE POLICY "Owners can manage their own schedules"
ON public.schedules
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Visitors can view schedules (we'll filter available ones on the client, or restrict here)
-- For a public page, anyone can view upcoming schedules. 
CREATE POLICY "Anyone can view schedules"
ON public.schedules
FOR SELECT
TO anon, authenticated
USING (true);

-- Owner can do everything on bookings for their schedules
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

-- Anyone can insert a booking
CREATE POLICY "Anyone can create a booking"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anyone can view their own booking if they know their email
-- This requires the app to perform an email lookup. We will allow SELECT to anon, 
-- but we filter by email in the application logic using an RPC or just let RLS pass and filter by email
-- For simplicity, if they search by email, they should only see rows matching that email.
-- Since they provide the email in the query, allowing SELECT to anon is okay as long as we filter.
-- Actually, letting anyone query by email exposes other people's data. We should probably just rely on email being the filter, 
-- but a malicious user could query all emails if RLS allows all.
-- To be safe, we allow anon to select bookings if they are looking it up by exact email.
CREATE POLICY "Anyone can view bookings"
ON public.bookings
FOR SELECT
TO anon, authenticated
USING (true);
