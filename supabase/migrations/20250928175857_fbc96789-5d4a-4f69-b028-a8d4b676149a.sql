-- Fix security issues by setting search_path for functions

-- Drop trigger first, then function, then recreate both
DROP TRIGGER IF EXISTS generate_issue_key_trigger ON public.issues;
DROP FUNCTION IF EXISTS generate_issue_key();
DROP FUNCTION IF EXISTS accept_project_invitation(text);

-- Recreate generate_issue_key function with search_path
CREATE OR REPLACE FUNCTION generate_issue_key()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Recreate trigger for issue key generation
CREATE TRIGGER generate_issue_key_trigger
  BEFORE INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION generate_issue_key();

-- Recreate accept_project_invitation function with search_path
CREATE OR REPLACE FUNCTION accept_project_invitation(invitation_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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