ALTER TYPE public.issue_type ADD VALUE IF NOT EXISTS 'client_meeting';
ALTER TYPE public.issue_type ADD VALUE IF NOT EXISTS 'team_meeting';

DROP POLICY IF EXISTS "Users can update their issues and admins can update all" ON public.issues;
CREATE POLICY "Team members can update issues"
ON public.issues FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can delete issues" ON public.issues;
CREATE POLICY "Team members can delete issues"
ON public.issues FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Leads admins and issue reporters can manage assignees" ON public.issue_assignees;
CREATE POLICY "Team members can manage issue assignees"
ON public.issue_assignees FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);