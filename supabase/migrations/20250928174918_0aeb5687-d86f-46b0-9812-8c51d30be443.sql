-- Add task key generation and project invitations

-- Add issue_key column to issues table  
ALTER TABLE public.issues 
ADD COLUMN issue_key text;

-- Create function to generate issue key
CREATE OR REPLACE FUNCTION generate_issue_key()
RETURNS TRIGGER AS $$
DECLARE
  project_key text;
  issue_count integer;
  new_key text;
BEGIN
  -- Get project key
  SELECT key INTO project_key 
  FROM projects 
  WHERE id = NEW.project_id;
  
  -- Get count of issues in project + 1
  SELECT COUNT(*) + 1 INTO issue_count
  FROM issues 
  WHERE project_id = NEW.project_id;
  
  -- Generate new key
  new_key := project_key || '-' || issue_count;
  
  -- Set the issue key
  NEW.issue_key := new_key;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for issue key generation
CREATE TRIGGER generate_issue_key_trigger
  BEFORE INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION generate_issue_key();

-- Create project_invitations table
CREATE TABLE public.project_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone
);

-- Enable RLS on project_invitations
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for project_invitations
CREATE POLICY "Project managers can create invitations" 
ON public.project_invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_invitations.project_id 
    AND (p.lead_id = auth.uid() OR p.created_by = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM profiles 
           WHERE user_id = auth.uid() 
           AND role IN ('admin', 'manager')
         ))
  )
);

CREATE POLICY "Project managers can view invitations" 
ON public.project_invitations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_invitations.project_id 
    AND (p.lead_id = auth.uid() OR p.created_by = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM profiles 
           WHERE user_id = auth.uid() 
           AND role IN ('admin', 'manager')
         ))
  )
);

CREATE POLICY "Users can view their own invitations" 
ON public.project_invitations 
FOR SELECT 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Create function to accept invitation
CREATE OR REPLACE FUNCTION accept_project_invitation(invitation_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record project_invitations%ROWTYPE;
  user_email text;
BEGIN
  -- Get current user email
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  -- Get invitation
  SELECT * INTO invitation_record
  FROM project_invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > now()
    AND email = user_email;
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update invitation status
  UPDATE project_invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = invitation_record.id;
  
  RETURN true;
END;
$$;