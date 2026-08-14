-- 1) Project open/closed state
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check CHECK (status IN ('active','closed'));

CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);

-- 2) Task creators (reporters) can assign members to their own issues
DROP POLICY IF EXISTS "Project leads and admins can manage assignees" ON public.issue_assignees;
CREATE POLICY "Leads admins and issue reporters can manage assignees"
ON public.issue_assignees
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.issues i
    JOIN public.projects p ON i.project_id = p.id
    WHERE i.id = issue_assignees.issue_id
      AND (
        i.reporter_id = auth.uid()
        OR i.assignee_id = auth.uid()
        OR p.lead_id = auth.uid()
        OR p.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.issues i
    JOIN public.projects p ON i.project_id = p.id
    WHERE i.id = issue_assignees.issue_id
      AND (
        i.reporter_id = auth.uid()
        OR i.assignee_id = auth.uid()
        OR p.lead_id = auth.uid()
        OR p.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      )
  )
);

-- 3) Make sure issue UPDATE policy explicitly has a WITH CHECK for admins/managers
DROP POLICY IF EXISTS "Users can update their issues and admins can update all" ON public.issues;
CREATE POLICY "Users can update their issues and admins can update all"
ON public.issues
FOR UPDATE
TO authenticated
USING (
  assignee_id = auth.uid()
  OR reporter_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.issue_assignees ia WHERE ia.issue_id = issues.id AND ia.user_id = auth.uid())
)
WITH CHECK (
  assignee_id = auth.uid()
  OR reporter_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.issue_assignees ia WHERE ia.issue_id = issues.id AND ia.user_id = auth.uid())
);