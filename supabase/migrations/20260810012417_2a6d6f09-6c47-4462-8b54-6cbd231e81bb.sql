CREATE TABLE public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_sessions TO authenticated;
GRANT ALL ON public.work_sessions TO service_role;

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view work sessions"
  ON public.work_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can start their own work sessions"
  ON public.work_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work sessions"
  ON public.work_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own work sessions"
  ON public.work_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX one_running_session_per_user
  ON public.work_sessions (user_id) WHERE ended_at IS NULL;

CREATE INDEX work_sessions_user_started_idx ON public.work_sessions (user_id, started_at DESC);

CREATE TRIGGER update_work_sessions_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.work_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_sessions;

-- Assignment notifications
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
BEGIN
  IF TG_TABLE_NAME = 'issue_assignees' THEN
    target_user := NEW.user_id;
    SELECT title, issue_key INTO task_title, task_key FROM public.issues WHERE id = NEW.issue_id;
  ELSE
    target_user := NEW.assignee_id;
    task_title := NEW.title;
    task_key := NEW.issue_key;
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
    '/issues/' || COALESCE(NEW.issue_id::text, NEW.id::text),
    jsonb_build_object('issue_id', COALESCE(NEW.issue_id, NEW.id))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_issue_assignee_added
  AFTER INSERT ON public.issue_assignees
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

CREATE TRIGGER notify_on_issue_assignee_changed
  AFTER INSERT OR UPDATE OF assignee_id ON public.issues
  FOR EACH ROW
  WHEN (NEW.assignee_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_task_assignment();