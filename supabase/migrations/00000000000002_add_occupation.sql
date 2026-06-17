-- ========================================
-- MyScheduler v2.1 - Add Occupation
-- Run this in your Supabase SQL Editor
-- ========================================

-- Add occupation column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS occupation TEXT;

-- Update the auto-create profile trigger to handle occupation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, occupation)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'occupation', 'Professional')
  );
  RETURN NEW;
END;
$$;
