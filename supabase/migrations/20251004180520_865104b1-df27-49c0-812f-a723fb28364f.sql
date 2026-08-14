-- Add coin_points column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS coin_points integer DEFAULT 0 NOT NULL;

-- Create calendar_entries table for project-specific calendars
CREATE TABLE IF NOT EXISTS public.calendar_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  title text NOT NULL,
  content text,
  images text[], -- Array of image URLs
  reference_links text[], -- Array of reference links/notes (renamed from 'references')
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on calendar_entries
ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;

-- Calendar entries policies
CREATE POLICY "Users can view calendar entries for their projects"
ON public.calendar_entries
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = calendar_entries.project_id
  )
);

CREATE POLICY "Users can create calendar entries"
ON public.calendar_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar entries"
ON public.calendar_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar entries"
ON public.calendar_entries
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_calendar_entries_updated_at
BEFORE UPDATE ON public.calendar_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to award coin points when issue is completed
CREATE OR REPLACE FUNCTION public.award_coin_points_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If issue status changed to 'done' and assignee exists
  IF NEW.status = 'done' AND OLD.status != 'done' AND NEW.assignee_id IS NOT NULL THEN
    -- Award 10 coin points to the assignee
    UPDATE profiles
    SET coin_points = coin_points + 10
    WHERE user_id = NEW.assignee_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for awarding coin points
CREATE TRIGGER trigger_award_coin_points
AFTER UPDATE ON public.issues
FOR EACH ROW
EXECUTE FUNCTION public.award_coin_points_on_completion();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_entries_project_date 
ON public.calendar_entries(project_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_calendar_entries_user 
ON public.calendar_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_coin_points 
ON public.profiles(coin_points DESC);