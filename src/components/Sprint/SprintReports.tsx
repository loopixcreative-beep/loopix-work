import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Target, Repeat } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { BoardStatus, Sprint, SprintTask } from './types';

const TASK_SELECT =
  'id, title, issue_key, story_points, labels, board_status, sprint_id, carried_over_count, backlog_rank, assignee_id, updated_at';

interface Props {
  projectId: string;
}

export const SprintReports = ({ projectId }: Props) => {
  const [params, setParams] = useSearchParams();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedId, setSelectedId] = useState<string>(params.get('sprint') || '');
  const [tasks, setTasks] = useState<SprintTask[]>([]);
  const [history, setHistory] = useState<{ task_id: string; status: BoardStatus; changed_at: string }[]>([]);
  const [velocity, setVelocity] = useState<{ name: string; completed: number; planned: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sprints')
        .select('*')
        .eq('project_id', projectId)
        .neq('status', 'planned')
        .order('start_date', { ascending: false });
      const rows = (data || []) as unknown as Sprint[];
      setSprints(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
      if (!rows.length) setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadSprint = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    const [{ data: taskRows }, { data: historyRows }] = await Promise.all([
      supabase.from('issues').select(TASK_SELECT).eq('sprint_id', selectedId),
      supabase
        .from('sprint_task_history')
        .select('task_id, status, changed_at, story_points')
        .eq('sprint_id', selectedId)
        .order('changed_at', { ascending: true }),
    ]);
    setTasks((taskRows || []) as unknown as SprintTask[]);
    setHistory((historyRows || []) as { task_id: string; status: BoardStatus; changed_at: string }[]);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    loadSprint();
  }, [loadSprint]);

  // Velocity across last 6 completed sprints
  useEffect(() => {
    (async () => {
      const completed = sprints.filter((s) => s.status === 'completed').slice(0, 6).reverse();
      if (!completed.length) return setVelocity([]);
      const results = await Promise.all(
        completed.map(async (s) => {
          const { data } = await supabase
            .from('sprint_task_history')
            .select('task_id, story_points, status')
            .eq('sprint_id', s.id)
            .eq('status', 'done');
          const done = new Map<string, number>();
          (data || []).forEach((h) => done.set(h.task_id, h.story_points || 0));
          const completedPts = [...done.values()].reduce((a, b) => a + b, 0);
          return { name: s.name, completed: completedPts, planned: s.capacity_points || completedPts };
        }),
      );
      setVelocity(results);
    })();
  }, [sprints]);

  const sprint = sprints.find((s) => s.id === selectedId) || null;

  const plannedPoints = tasks.reduce((s, t) => s + (t.story_points || 0), 0);
  const donePoints = tasks
    .filter((t) => t.board_status === 'done')
    .reduce((s, t) => s + (t.story_points || 0), 0);
  const carriedPoints = tasks
    .filter((t) => t.board_status !== 'done')
    .reduce((s, t) => s + (t.story_points || 0), 0);
  const repeatedlyDelayed = tasks.filter((t) => (t.carried_over_count || 0) >= 2);

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
        day: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        remaining: day.getTime() > Date.now() ? null : remaining,
        ideal: Math.max(Math.round(plannedPoints - (plannedPoints / Math.max(days - 1, 1)) * i), 0),
      };
    });
  }, [sprint, history, tasks, plannedPoints]);

  if (!sprints.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-lg font-bold">No sprint data yet</h3>
          <p className="text-sm text-muted-foreground">Start a sprint to begin tracking burndown and velocity.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedId}
          onValueChange={(v) => {
            setSelectedId(v);
            setParams({ sprint: v });
          }}
        >
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sprints.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} · {s.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sprint?.goal && <span className="text-sm text-muted-foreground">{sprint.goal}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Planned points', value: plannedPoints, tone: 'text-chart-1', icon: Target },
          { label: 'Completed points', value: donePoints, tone: 'text-chart-6', icon: TrendingUp },
          { label: 'Carried over', value: carriedPoints, tone: 'text-chart-2', icon: Repeat },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="rounded-lg bg-muted p-2">
                <s.icon className={`h-5 w-5 ${s.tone}`} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {repeatedlyDelayed.length > 0 && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle>Repeatedly delayed work</AlertTitle>
          <AlertDescription>
            <div className="mt-1 flex flex-wrap gap-2">
              {repeatedlyDelayed.map((t) => (
                <Badge key={t.id} variant="outline" className="border-destructive/40">
                  {t.title} · carried {t.carried_over_count}x
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Burndown</CardTitle></CardHeader>
        <CardContent className="h-72">
          {loading ? (
            <div className="h-full animate-pulse rounded-lg bg-muted" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ideal" name="Ideal pace" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="remaining" name="Remaining pts" stroke="hsl(var(--chart-1))" strokeWidth={3} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Velocity — last 6 sprints</CardTitle></CardHeader>
        <CardContent className="h-72">
          {velocity.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Complete a sprint to start building velocity history.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="planned" name="Capacity" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
