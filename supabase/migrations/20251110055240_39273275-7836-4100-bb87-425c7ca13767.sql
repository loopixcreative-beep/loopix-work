-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add approval status to issues
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Create media_library table
CREATE TABLE IF NOT EXISTS public.media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on media_library
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- RLS policies for media_library
CREATE POLICY "Users can view media in their projects"
  ON public.media_library
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      project_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = media_library.project_id
      )
    )
  );

CREATE POLICY "Users can upload media"
  ON public.media_library
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media"
  ON public.media_library
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media"
  ON public.media_library
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at on media_library
CREATE TRIGGER update_media_library_updated_at
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_library_project_id ON public.media_library(project_id);
CREATE INDEX IF NOT EXISTS idx_media_library_user_id ON public.media_library(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_approval_status ON public.issues(approval_status);