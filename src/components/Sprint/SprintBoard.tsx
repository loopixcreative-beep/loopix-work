import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, X, Rocket } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip as RTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { SprintTaskCard } from './SprintTaskCard';
import { BOARD_COLUMNS, BoardStatus, Sprint, SprintTask } from './types';

const TASK_SELECT =
  'id, title, issue_key, story_points, labels, board_status, sprint_id, carried_over_count, backlog_rank, assignee_id, updated_at, assignee:profiles!issues_assignee_id_fkey(full_name, email, avatar_url)';

interface Props {
  projectId: string;
  canManage: boolean;
}

export const SprintBoard = ({ projectId, canManage }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [tasks, setTasks] = useState<SprintTask[]>([]);
  const [history, setHistory] = useState<{ task_id: string; status: BoardStatus; changed_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<SprintTask | null>(null);
  const [overColumn, setOverColumn] = useState<BoardStatus | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sprintRows } = await supabase
      .from('sprints')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .limit(1);
    const active = (sprintRows?.[0] as unknown as Sprint) || null;
    setSprint(active);

    if (active) {
      const [{ data: taskRows }, { data: historyRows }] = await Promise.all([
        supabase.from('issues').select(TASK_SELECT).eq('sprint_id', active.id),
        supabase
          .from('sprint_task_history')
          .select('task_id, status, changed_at')
          .eq('sprint_id', active.id)
          .order('changed_at', { ascending: true }),
      ]);
      setTasks((taskRows || []) as unknown as SprintTask[]);
      setHistory((historyRows || []) as { task_id: string; status: BoardStatus; changed_at: string }[]);
    } else {
      setTasks([]);
      setHistory([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const lastMoved = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((h) => map.set(h.task_id, h.changed_at));
    return map;
  }, [history]);

  const isStale = (task: SprintTask) => {
    if (task.board_status === 'done') return false;
    const ts = lastMoved.get(task.id) || task.updated_at;
    return Date.now() - new Date(ts).getTime() > 3 * 86400000;
  };

  const drop = async (status: BoardStatus) => {
    setOverColumn(null);
    const task = dragging;
    setDragging(null);
    if (!task || task.board_status === status || !sprint) return;

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, board_status: status } : t)));

    const { error } = await supabase
      .from('issues')
      .update({
        board_status: status,
        status: status === 'done' ? 'done' : status === 'review' ? 'review' : status === 'in_progress' ? 'in_progress' : 'to_do',
      })
      .eq('id', task.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      load();
      return;
    }

    await supabase.from('sprint_task_history').insert({
      sprint_id: sprint.id,
      task_id: task.id,
      status,
      story_points: task.story_points,
      changed_by: user?.id ?? null,
    });
    setHistory((prev) => [...prev, { task_id: task.id, status, changed_at: new Date().toISOString() }]);
  };

  const totalPoints = tasks.reduce((s, t) => s + (t.story_points || 0), 0);

  const { dayX, dayY, elapsedPct, endsTomorrow } = useMemo(() => {
    if (!sprint) return { dayX: 0, dayY: 0, elapsedPct: 0, endsTomorrow: false };
    const start = new Date(sprint.start_date).setHours(0, 0, 0, 0);
    const end = new Date(sprint.end_date).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    const total = Math.max(Math.round((end - start) / 86400000) + 1, 1);
    const current = Math.min(Math.max(Math.round((today - start) / 86400000) + 1, 1), total);
    return {
      dayX: current,
      dayY: total,
      elapsedPct: Math.round((current / total) * 100),
      endsTomorrow: (end - today) / 86400000 <= 1 && end >= today,
    };
  }, [sprint]);

  const burndown = useMemo(() => {
    if (!sprint) return [];
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const days = Math.max(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 1);
    const doneAt = new Map<string, number>();
    history
      .filter((h) => h.status === 'done')
      .forEach((h) => {
        if (!doneAt.has(h.task_id)) doneAt.set(h.task_id, new Date(h.changed_at).getTime());
      });
    return Array.from({ length: days }, (_, i) => {
      const day = new Date(start.getTime() + i * 86400000);
      const cutoff = new Date(day).setHours(23, 59, 59, 999);
      const remaining = tasks.reduce((sum, t) => {
        const d = doneAt.get(t.id);
        return d && d <= cutoff ? sum : sum + (t.story_points || 0);
      }, 0);
      return {
        day: `D${i + 1}`,
        remaining: day.getTime() > Date.now() ? null : remaining,
        ideal: Math.round(totalPoints - (totalPoints / Math.max(days - 1, 1)) * i),
      };
    });
  }, [sprint, history, tasks, totalPoints]);

  const notStarted = tasks.filter((t) => t.board_status === 'todo');
  const incomplete = tasks.filter((t) => t.board_status !== 'done');

  const completeSprint = async (destination: 'backlog' | 'new') => {
    if (!sprint) return;
    let newSprintId: string | null = null;

    if (destination === 'new') {
      const { count } = await supabase
        .from('sprints')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      const { data, error } = await supabase
        .from('sprints')
        .insert({
          project_id: projectId,
          name: `Sprint ${(count || 0) + 1}`,
          start_date: new Date().toISOString().slice(0, 10),
          end_date: new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10),
          status: 'planned',
          capacity_points: sprint.capacity_points,
        })
        .select('id')
        .single();
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      newSprintId = data.id;
    }

    await Promise.all(
      incomplete.map((t) =>
        supabase
          .from('issues')
          .update({ sprint_id: newSprintId, carried_over_count: (t.carried_over_count || 0) + 1 })
          .eq('id', t.id),
      ),
    );

    const { error } = await supabase
      .from('sprints')
      .update({ status: 'completed', completed_at: new Date().toISOString(), is_active: false } as never)
      .eq('id', sprint.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setCompleteOpen(false);
    toast({ title: 'Sprint completed', description: `${sprint.name} wrapped up.` });
    navigate(`/sprints/reports?sprint=${sprint.id}`);
  };

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  if (!sprint) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <Rocket className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-lg font-bold">No active sprint</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks flow in from your projects. Start a sprint from the project to see the board here.
          </p>
          <Button asChild className="mt-4">
            <Link to="/sprints/timeline">View Timeline</Link>
          </Button>

        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {endsTomorrow && notStarted.length > 0 && !bannerDismissed && (
        <Alert className="border-chart-2/40 bg-chart-2/10">
          <AlertTriangle className="h-4 w-4 text-chart-2" />
          <AlertDescription className="flex items-center gap-2">
            <span className="font-semibold">
              Sprint ends tomorrow — {notStarted.length} task{notStarted.length === 1 ? '' : 's'} not yet started.
            </span>
            <button className="ml-auto" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{sprint.name}</h2>
                <Badge variant="secondary">Day {dayX} of {dayY}</Badge>
                {sprint.capacity_points ? (
                  <Badge variant="outline">{totalPoints} / {sprint.capacity_points} pts</Badge>
                ) : (
                  <Badge variant="outline">{totalPoints} pts</Badge>
                )}
              </div>
              {sprint.goal && <p className="mt-0.5 text-sm text-muted-foreground">{sprint.goal}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(sprint.start_date).toLocaleDateString()} – {new Date(sprint.end_date).toLocaleDateString()}
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Sprint
              </Button>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${elapsedPct}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Board */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-4 md:overflow-visible">
        {BOARD_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.board_status === col.key);
          const limit = sprint.wip_limits?.[col.key];
          const overLimit = !!limit && colTasks.length > limit;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverColumn(col.key);
              }}
              onDragLeave={() => setOverColumn(null)}
              onDrop={() => drop(col.key)}
              className={cn(
                'min-w-[260px] flex-1 rounded-xl border bg-muted/40 p-3 transition-colors',
                overColumn === col.key && 'border-primary/50 bg-primary/5',
                overLimit && 'border-chart-2/60',
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <h3 className={cn('text-sm font-bold uppercase tracking-wide', overLimit && 'text-chart-2')}>
                  {col.title}
                </h3>
                <Badge variant="secondary" className="ml-auto">
                  {colTasks.length}{limit ? ` / ${limit}` : ''}
                </Badge>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <SprintTaskCard
                    key={task.id}
                    task={task}
                    draggable
                    stale={isStale(task)}
                    onDragStart={() => setDragging(task)}
                    onDragEnd={() => setDragging(null)}
                  />
                ))}
                {colTasks.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">Drop tasks here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Burndown strip */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">Burndown trend</h3>
            <Link to="/sprints/reports" className="text-xs font-semibold text-primary hover:underline">
              View full report
            </Link>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burndown}>
                <defs>
                  <linearGradient id="burnStrip" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <RTooltip />
                <Area type="monotone" dataKey="remaining" stroke="hsl(var(--chart-1))" fill="url(#burnStrip)" strokeWidth={2} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete {sprint.name}?</DialogTitle>
            <DialogDescription>
              {incomplete.length === 0
                ? 'Everything is done. Nice work!'
                : `${incomplete.length} task${incomplete.length === 1 ? '' : 's'} are not done yet:`}
            </DialogDescription>
          </DialogHeader>
          {incomplete.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {incomplete.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="truncate">{t.title}</span>
                  <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                    {BOARD_COLUMNS.find((c) => c.key === t.board_status)?.title}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => completeSprint('backlog')}>
              Move to Backlog
            </Button>
            <Button onClick={() => completeSprint('new')}>Move to a new Sprint</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
