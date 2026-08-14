import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Clock, ListTodo, AlertTriangle, Search, ArrowUpRight } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface MyTask {
  id: string;
  title: string;
  description: string | null;
  issue_key: string | null;
  status: string;
  board_status: string;
  priority: string;
  issue_type: string;
  due_date: string | null;
  project_id: string;
  project?: { name: string; key: string | null; status: string | null } | null;
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'to_do', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'In Review' },
  { key: 'done', label: 'Done' },
];

const statusTone: Record<string, string> = {
  to_do: 'bg-muted text-foreground',
  in_progress: 'bg-chart-1/15 text-chart-1 border-chart-1/30',
  review: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
  done: 'bg-chart-6/15 text-chart-6 border-chart-6/30',
};

const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const MyTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusTab, setStatusTab] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const SELECT =
    'id, title, description, issue_key, status, board_status, priority, issue_type, due_date, project_id, project:projects!issues_project_id_fkey(name, key, status)';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: links } = await supabase
      .from('issue_assignees')
      .select('issue_id')
      .eq('user_id', user.id);

    const ids = (links || []).map((l) => l.issue_id);

    const [direct, linked] = await Promise.all([
      supabase.from('issues').select(SELECT).eq('assignee_id', user.id),
      ids.length
        ? supabase.from('issues').select(SELECT).in('id', ids)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const merged = new Map<string, MyTask>();
    [...((direct.data || []) as unknown as MyTask[]), ...((linked.data || []) as unknown as MyTask[])].forEach(
      (t) => merged.set(t.id, t),
    );

    setTasks(
      Array.from(merged.values()).filter((t) => t.project?.status !== 'closed'),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => t.project && map.set(t.project_id, t.project.name));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const today = startOfDay(new Date());
  const overdue = tasks.filter(
    (t) => t.due_date && t.status !== 'done' && isBefore(new Date(t.due_date), today),
  );
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');

  const visible = tasks
    .filter((t) => (statusTab === 'all' ? true : t.status === statusTab))
    .filter((t) => (projectFilter === 'all' ? true : t.project_id === projectFilter))
    .filter((t) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.issue_key || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  const advance = async (task: MyTask, next: string) => {
    setUpdating(task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    await supabase.from('issues').update({ status: next as never }).eq('id', task.id);
    setUpdating(null);
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand bg-[length:200%_200%] p-5 text-primary-foreground shadow-stat animate-gradient-pan sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Tasks</h1>
        <p className="mt-1 text-sm opacity-90">
          {open.length} open · {overdue.length} overdue across {projects.length} active project
          {projects.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned" value={tasks.length} hint="Across active projects" icon={ListTodo} tone="blue" />
        <StatCard label="In progress" value={inProgress.length} hint="Being worked on" icon={Clock} tone="orange" />
        <StatCard label="Completed" value={done.length} hint={`${tasks.length ? Math.round((done.length / tasks.length) * 100) : 0}% done`} icon={CheckCircle2} tone="green" progress={tasks.length ? (done.length / tasks.length) * 100 : 0} />
        <StatCard label="Overdue" value={overdue.length} hint="Past due date" icon={AlertTriangle} tone="amber" />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Assigned to me</CardTitle>
              <CardDescription>Everything on your plate, newest deadlines first</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="h-9 w-[200px] pl-8"
                />
              </div>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Tabs value={statusTab} onValueChange={setStatusTab}>
            <TabsList className="flex-wrap">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading && <div className="h-40 animate-pulse rounded-lg bg-muted" />}
          {!loading && visible.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nothing here. Tasks assigned to you across active projects will show up automatically.
            </p>
          )}
          {visible.map((task) => {
            const isOverdue =
              task.due_date && task.status !== 'done' && isBefore(new Date(task.due_date), today);
            return (
              <div
                key={task.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{task.issue_key}</span>
                    <Link to={`/issues/${task.id}`} className="font-semibold hover:underline">
                      {task.title}
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.project?.name} · {fmt(task.issue_type)}
                    {task.due_date && (
                      <span className={cn('ml-1', isOverdue && 'font-bold text-destructive')}>
                        · Due {format(new Date(task.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className={cn('capitalize', statusTone[task.status])}>
                  {fmt(task.status)}
                </Badge>
                <Badge variant="secondary" className="capitalize">{task.priority}</Badge>
                {task.status !== 'done' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating === task.id}
                    onClick={() => advance(task, task.status === 'to_do' ? 'in_progress' : 'done')}
                  >
                    {task.status === 'to_do' ? 'Start' : 'Mark done'}
                  </Button>
                )}
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/issues/${task.id}`}>
                    View <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTasks;
