-- Create issue_assignees junction table for multiple assignees per issue
CREATE TABLE IF NOT EXISTS public.issue_assignees (
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, user_id)
);

-- Enable RLS on issue_assignees
ALTER TABLE public.issue_assignees ENABLE ROW LEVEL SECURITY;

-- RLS policies for issue_assignees
CREATE POLICY "Users can view issue assignees" ON public.issue_assignees
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Project leads and admins can manage assignees" ON public.issue_assignees
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM issues i
    JOIN projects p ON i.project_id = p.id
    WHERE i.id = issue_assignees.issue_id
    AND (p.lead_id = auth.uid() OR p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
);

-- Update RLS policy on projects to allow admins to delete
DROP POLICY IF EXISTS "Project leads and admins can update projects" ON public.projects;

CREATE POLICY "Project leads and admins can manage projects" ON public.projects
FOR ALL USING (
  (lead_id = auth.uid()) OR 
  (created_by = auth.uid()) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Update issues RLS to allow admins full control
DROP POLICY IF EXISTS "Assignees and reporters can update issues" ON public.issues;

CREATE POLICY "Users can update their issues and admins can update all" ON public.issues
FOR UPDATE USING (
  (assignee_id = auth.uid()) OR 
  (reporter_id = auth.uid()) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Allow admins to delete issues
CREATE POLICY "Admins can delete issues" ON public.issues
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  reporter_id = auth.uid()
);

-- Create user preferences table for settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email_notifications boolean DEFAULT true,
  task_assignments boolean DEFAULT true,
  project_updates boolean DEFAULT true,
  deadline_reminders boolean DEFAULT true,
  weekly_digest boolean DEFAULT false,
  working_hours integer DEFAULT 9,
  default_duration integer DEFAULT 8,
  start_of_week text DEFAULT 'sunday',
  calendar_view text DEFAULT 'month',
  profile_visibility text DEFAULT 'team',
  activity_tracking boolean DEFAULT true,
  two_factor_auth boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_preferences
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.user_preferences
FOR UPDATE USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();