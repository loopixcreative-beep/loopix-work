-- Fix: notify_task_assignment() unconditionally referenced NEW.issue_id, but that
-- column only exists on issue_assignees rows. When the same function runs for the
-- issues-table trigger (assignee_id changed on an issue), NEW is an issues row,
-- which has no issue_id column — Postgres raised "record 'new' has no field
-- 'issue_id'" on every issue update that touches assignee_id (which the edit-issue
-- form always includes, so this fired on nearly every task edit).
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
  actor uuid := auth.uid();
  task_title text;
  task_key text;
  actor_name text;
  related_issue_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'issue_assignees' THEN
    target_user := NEW.user_id;
    related_issue_id := NEW.issue_id;
    SELECT title, issue_key INTO task_title, task_key FROM public.issues WHERE id = NEW.issue_id;
  ELSE
    target_user := NEW.assignee_id;
    task_title := NEW.title;
    task_key := NEW.issue_key;
    related_issue_id := NEW.id;
  END IF;

  IF target_user IS NULL OR target_user = actor THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, email) INTO actor_name FROM public.profiles WHERE user_id = actor;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    target_user,
    'task_assigned',
    'New task assigned to you',
    COALESCE(actor_name, 'Someone') || ' assigned you ' || COALESCE(task_key || ' · ', '') || COALESCE(task_title, 'a task'),
    '/issues/' || related_issue_id::text,
    jsonb_build_object('issue_id', related_issue_id)
  );

  RETURN NEW;
END;
$$;
