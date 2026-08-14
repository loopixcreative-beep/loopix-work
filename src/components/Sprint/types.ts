export type BoardStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type SprintStatus = 'planned' | 'active' | 'completed';

export interface SprintTask {
  id: string;
  title: string;
  issue_key: string | null;
  story_points: number | null;
  labels: string[] | null;
  board_status: BoardStatus;
  sprint_id: string | null;
  carried_over_count: number;
  backlog_rank: number | null;
  assignee_id: string | null;
  updated_at: string;
  assignee?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  capacity_points: number | null;
  completed_at: string | null;
  wip_limits: Record<string, number> | null;
}

export const BOARD_COLUMNS: { key: BoardStatus; title: string }[] = [
  { key: 'todo', title: 'To Do' },
  { key: 'in_progress', title: 'In Progress' },
  { key: 'review', title: 'Review' },
  { key: 'done', title: 'Done' },
];

const LABEL_TONES = [
  'bg-chart-1/15 text-chart-1 border-chart-1/30',
  'bg-chart-2/15 text-chart-2 border-chart-2/30',
  'bg-chart-3/15 text-chart-3 border-chart-3/30',
  'bg-chart-4/15 text-chart-4 border-chart-4/30',
  'bg-chart-5/15 text-chart-5 border-chart-5/30',
];

export const labelTone = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) % 997;
  return LABEL_TONES[hash % LABEL_TONES.length];
};

export const daysBetween = (a: Date, b: Date) =>
  Math.round((b.setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 86400000);
