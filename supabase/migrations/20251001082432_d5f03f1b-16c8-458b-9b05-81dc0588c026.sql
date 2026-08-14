-- Add new columns to profiles table for team management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'available',
ADD COLUMN IF NOT EXISTS team_department text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS location text;

-- Create an index on skills for better search performance
CREATE INDEX IF NOT EXISTS idx_profiles_skills ON public.profiles USING GIN(skills);

-- Add check constraint for availability status
ALTER TABLE public.profiles
ADD CONSTRAINT check_availability_status 
CHECK (availability_status IN ('available', 'busy', 'on_leave', 'offline'));

COMMENT ON COLUMN public.profiles.skills IS 'Array of skills/expertise tags';
COMMENT ON COLUMN public.profiles.availability_status IS 'Current availability: available, busy, on_leave, offline';
COMMENT ON COLUMN public.profiles.team_department IS 'Team or department name';
COMMENT ON COLUMN public.profiles.bio IS 'User bio/description';
COMMENT ON COLUMN public.profiles.phone IS 'Contact phone number';
COMMENT ON COLUMN public.profiles.location IS 'User location/timezone';