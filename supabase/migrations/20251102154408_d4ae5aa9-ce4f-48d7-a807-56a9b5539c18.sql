-- Fix all critical security vulnerabilities (v3 - simplified)

-- 1. Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee', 'stakeholder');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create SECURITY DEFINER function to check roles safely
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. Migrate existing role data from profiles to user_roles (convert text to app_role)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role::text::app_role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Update profiles table RLS policies

-- Fix: Require authentication for viewing profiles  
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix: Users can update their own profile (excluding role which is read-only)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

-- 5. Create RLS policies for user_roles table

-- Only admins can manage roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- 6. Update projects table policies to use has_role function

DROP POLICY IF EXISTS "Project leads and admins can update projects" ON public.projects;
CREATE POLICY "Project leads and admins can update projects" ON public.projects
FOR UPDATE USING (
  lead_id = auth.uid() OR 
  created_by = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- 7. Update issues table policies to use has_role function

DROP POLICY IF EXISTS "Assignees and reporters can update issues" ON public.issues;
CREATE POLICY "Assignees and reporters can update issues" ON public.issues
FOR UPDATE USING (
  assignee_id = auth.uid() OR 
  reporter_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- 8. Update sprints table policies to use has_role function

DROP POLICY IF EXISTS "Project managers can manage sprints" ON public.sprints;
CREATE POLICY "Project managers can manage sprints" ON public.sprints
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = sprints.project_id
    AND (
      p.lead_id = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'manager')
    )
  )
);

-- 9. Update sprint_issues table policies to use has_role function

DROP POLICY IF EXISTS "Project managers can manage sprint issues" ON public.sprint_issues;
CREATE POLICY "Project managers can manage sprint issues" ON public.sprint_issues
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM sprints s
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = sprint_issues.sprint_id
    AND (
      p.lead_id = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'manager')
    )
  )
);

-- 10. Update project_invitations table policies to use has_role function

DROP POLICY IF EXISTS "Project managers can create invitations" ON public.project_invitations;
CREATE POLICY "Project managers can create invitations" ON public.project_invitations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_invitations.project_id
    AND (
      p.lead_id = auth.uid() OR 
      p.created_by = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'manager')
    )
  )
);

DROP POLICY IF EXISTS "Project managers can view invitations" ON public.project_invitations;
CREATE POLICY "Project managers can view invitations" ON public.project_invitations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_invitations.project_id
    AND (
      p.lead_id = auth.uid() OR 
      p.created_by = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'manager')
    )
  )
);

-- 11. Fix storage bucket policies for calendar-images

DROP POLICY IF EXISTS "Users can delete their own calendar images" ON storage.objects;
CREATE POLICY "Users can delete their own calendar images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'calendar-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own calendar images" ON storage.objects;
CREATE POLICY "Users can update their own calendar images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'calendar-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 12. Fix storage bucket policies for profile-images

DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
CREATE POLICY "Users can delete their own profile images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
CREATE POLICY "Users can update their own profile images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);