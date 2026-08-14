-- Every other issues policy (SELECT, INSERT, DELETE) and the issue_assignees SELECT
-- policy are already open to any authenticated team member, and the app's edit-issue
-- UI already assumes any signed-in user can edit ("Any signed-in team member can edit
-- or delete tasks" in IssueDetail.tsx). But the issues UPDATE policy was still limited
-- to the assignee/reporter/admin/manager, and issue_assignees management (used to sync
-- the multi-assignee list on every edit) was limited to lead/creator/reporter/admin/
-- manager. That mismatch silently blocked other project members from saving edits.
-- Bring both in line with the rest of the schema's open-team model.

DROP POLICY IF EXISTS "Users can update their issues and admins can update all" ON public.issues;
CREATE POLICY "Team members can update issues"
ON public.issues
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Leads admins and issue reporters can manage assignees" ON public.issue_assignees;
CREATE POLICY "Team members can manage assignees"
ON public.issue_assignees
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
