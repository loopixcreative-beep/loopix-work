-- Auto-approve a task and notify every project member when it is moved to "Done".
CREATE OR REPLACE FUNCTION public.notify_approval_on_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_id uuid;
  task_link text;
  actor_name text;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.approval_status := 'approved';
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();

    task_link := '/projects/' || NEW.project_id || '/issues/' || NEW.id;
    SELECT COALESCE(full_name, email) INTO actor_name FROM public.profiles WHERE user_id = auth.uid();

    FOR member_id IN
      SELECT DISTINCT uid FROM (
        SELECT lead_id AS uid FROM public.projects WHERE id = NEW.project_id
        UNION
        SELECT created_by AS uid FROM public.projects WHERE id = NEW.project_id
        UNION
        SELECT reporter_id AS uid FROM public.issues WHERE project_id = NEW.project_id
        UNION
        SELECT assignee_id AS uid FROM public.issues WHERE project_id = NEW.project_id
        UNION
        SELECT ia.user_id AS uid
          FROM public.issue_assignees ia
          JOIN public.issues i2 ON i2.id = ia.issue_id
          WHERE i2.project_id = NEW.project_id
      ) members
      WHERE uid IS NOT NULL
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (
        member_id,
        'task_done',
        'Task marked as Done',
        COALESCE(actor_name, 'A team member') || ' marked "' || NEW.title || '" as Done. It has been auto-approved.',
        task_link,
        jsonb_build_object('issue_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_approval_on_done ON public.issues;
CREATE TRIGGER trg_notify_approval_on_done
  BEFORE UPDATE OF status ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_approval_on_done();
