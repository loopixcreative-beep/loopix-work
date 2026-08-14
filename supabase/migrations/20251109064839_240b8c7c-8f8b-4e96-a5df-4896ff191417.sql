-- Add objectives and goals to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS goals TEXT;

-- Convert issue_type column to text temporarily
ALTER TABLE public.issues ALTER COLUMN issue_type TYPE TEXT;

-- Drop the old issue_type enum
DROP TYPE IF EXISTS public.issue_type CASCADE;

-- Create new issue_type enum with marketing/design types
CREATE TYPE public.issue_type AS ENUM (
  'promotional_post',
  'event_post',
  'festive_post',
  'reels',
  'content_creation',
  'ads_campaign',
  'calendar_content',
  'profile_image',
  'cover_image',
  'logo_design',
  'website_development',
  'app_development',
  'ui_ux_design',
  'backend',
  'frontend',
  'task',
  'bug',
  'other'
);

-- Map old values to new enum values
UPDATE public.issues 
SET issue_type = CASE 
  WHEN issue_type = 'story' THEN 'content_creation'
  WHEN issue_type = 'epic' THEN 'other'
  WHEN issue_type = 'ticket' THEN 'task'
  ELSE COALESCE(issue_type, 'task')
END;

-- Convert column back to enum type
ALTER TABLE public.issues 
  ALTER COLUMN issue_type TYPE public.issue_type 
  USING issue_type::public.issue_type;

-- Set default
ALTER TABLE public.issues 
  ALTER COLUMN issue_type SET DEFAULT 'task'::issue_type;

-- Add media attachments and approval to comments
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS media_urls TEXT[];
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;