-- Sprint status enum
DO $$ BEGIN
  CREATE TYPE public.sprint_status AS ENUM ('planned', 'active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.board_status AS ENUM ('todo', 'in_progress', 'review', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sprints additions
ALTER TABLE public.sprints
  ADD COLUMN IF NOT EXISTS status public.sprint_status NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS capacity_points integer,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS wip_limits jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.sprints SET status = 'active' WHERE is_active IS TRUE AND status = 'planned';

-- Only one active sprint per project
CREATE UNIQUE INDEX IF NOT EXISTS sprints_one_active_per_project
  ON public.sprints (project_id)
  WHERE status = 'active';

-- Issues (tasks) additions
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES public.sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_points integer,
  ADD COLUMN IF NOT EXISTS board_status public.board_status NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS carried_over_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backlog_rank integer;

CREATE INDEX IF NOT EXISTS issues_sprint_id_idx ON public.issues (sprint_id);

-- Sprint task history
CREATE TABLE IF NOT EXISTS public.sprint_task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  status public.board_status NOT NULL,
  story_points integer,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sprint_task_history TO authenticated;
GRANT ALL ON public.sprint_task_history TO service_role;

ALTER TABLE public.sprint_task_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view sprint task history" ON public.sprint_task_history;
CREATE POLICY "Authenticated users can view sprint task history"
  ON public.sprint_task_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can log sprint task history" ON public.sprint_task_history;
CREATE POLICY "Authenticated users can log sprint task history"
  ON public.sprint_task_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = changed_by);

CREATE INDEX IF NOT EXISTS sprint_task_history_sprint_idx ON public.sprint_task_history (sprint_id, changed_at);

-- Allow updating/deleting sprints for signed-in users (UI gates to admin/manager)
DROP POLICY IF EXISTS "Authenticated users can update sprints" ON public.sprints;
CREATE POLICY "Authenticated users can update sprints"
  ON public.sprints FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete sprints" ON public.sprints;
CREATE POLICY "Authenticated users can delete sprints"
  ON public.sprints FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);