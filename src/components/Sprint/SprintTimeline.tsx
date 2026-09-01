import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ChevronLeft, ChevronRight, CalendarRange, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoardStatus } from './types';

type Row = {
  id: string;
  title: string;
  issue_key: string | null;
  board_status: BoardStatus;
  status: string;
  issue_type: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  project_id: string;
  assignee_id: string | null;
  project?: { name: string; key: string; status: string; type: string } | null;
  assignee?: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
};

const SELECT =
  'id, title, issue_key, board_status, status, issue_type, due_date, created_at, updated_at, project_id, assignee_id, project:projects!issues_project_id_fkey(name, key, status, type), assignee:profiles!issues_assignee_id_fkey(full_name, email, avatar_url)';

const STATUS_META: { key: BoardStatus; title: string; bar: string; dot: string }[] = [
  { key: 'todo', title: 'To Do', bar: 'bg-muted-foreground/40 border-muted-foreground/50', dot: 'bg-muted-foreground' },
  { key: 'in_progress', title: 'In Progress', bar: 'bg-primary/70 border-primary', dot: 'bg-primary' },
  { key: 'review', title: 'In Review', bar: 'bg-brand-orange/70 border-brand-orange', dot: 'bg-brand-orange' },
  { key: 'done', title: 'Done', bar: 'bg-chart-4/70 border-chart-4', dot: 'bg-chart-4' },
];

const RANGES = [
  { key: '7', label: '1 Week', days: 7 },
  { key: '14', label: '2 Weeks', days: 14 },
  { key: '30', label: '1 Month', days: 30 },
];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => new Date(startOfDay(d).getTime() + n * 86400000);
const fmtType = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const SprintTimeline = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState('7');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 7;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('issues').select(SELECT).order('due_date', { ascending: true });
    setRows(((data || []) as unknown as Row[]).filter((r) => r.project?.status !== 'closed'));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const windowStart = anchor;
  const windowEnd = addDays(anchor, days - 1);

  const dayCells = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(windowStart, i)),
    [days, windowStart],
  );

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => r.project && map.set(r.project_id, r.project.name));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.issue_type))).sort(),
    [rows],
  );

  const people = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.assignee_id && r.assignee) map.set(r.assignee_id, r.assignee.full_name || r.assignee.email || 'User');
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const spanFor = (r: Row) => {
    const start = startOfDay(new Date(r.created_at));
    const end = r.due_date ? startOfDay(new Date(r.due_date)) : start;
    return { start, end: end < start ? start : end };
  };

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (projectFilter !== 'all' && r.project_id !== projectFilter) return false;
      if (typeFilter !== 'all' && r.issue_type !== typeFilter) return false;
      if (assigneeFilter !== 'all' && r.assignee_id !== assigneeFilter) return false;
      if (statusFilter !== 'all' && r.board_status !== statusFilter) return false;
      const { start, end } = spanFor(r);
      return end >= windowStart && start <= windowEnd;
    });
  }, [rows, projectFilter, typeFilter, assigneeFilter, statusFilter, windowStart, windowEnd]);

  const grouped = STATUS_META.map((s) => ({
    ...s,
    items: visible.filter((r) => r.board_status === s.key),
  }));

  const todayIndex = dayCells.findIndex((d) => d.getTime() === startOfDay(new Date()).getTime());

  const barStyle = (r: Row) => {
    const { start, end } = spanFor(r);
    const from = Math.max(0, Math.round((start.getTime() - windowStart.getTime()) / 86400000));
    const to = Math.min(days - 1, Math.round((end.getTime() - windowStart.getTime()) / 86400000));
    return { left: `${(from / days) * 100}%`, width: `${((to - from + 1) / days) * 100}%` };
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(anchor, -days))} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(anchor, days))} aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="h-4 w-4 text-primary" />
            {windowStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {windowEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={rangeKey} onValueChange={setRangeKey}>
              <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Task type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All task types</SelectItem>
                {types.map((t) => <SelectItem key={t} value={t}>{fmtType(t)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_META.map((s) => <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-xs font-semibold text-muted-foreground">
        {STATUS_META.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />
            {s.title}
            <Badge variant="secondary" className="ml-1">{grouped.find((g) => g.key === s.key)?.items.length ?? 0}</Badge>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No tasks fall inside this timeframe. Try widening the range or clearing filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[880px]">
              {/* Day header */}
              <div className="flex border-b bg-muted/40">
                <div className="w-64 shrink-0 border-r px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Task
                </div>
                <div className="relative flex flex-1">
                  {dayCells.map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex-1 border-r px-1 py-2 text-center text-xs font-semibold last:border-r-0',
                        i === todayIndex && 'bg-primary/10 text-primary',
                      )}
                    >
                      <div>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="text-[0.7rem] text-muted-foreground">{d.getDate()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {grouped.filter((g) => g.items.length > 0).map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-1.5">
                    <span className={cn('h-2 w-2 rounded-full', group.dot)} />
                    <span className="text-xs font-bold uppercase tracking-wide">{group.title}</span>
                    <Badge variant="secondary" className="ml-1">{group.items.length}</Badge>
                  </div>
                  {group.items.map((r) => (
                    <div key={r.id} className="flex border-b last:border-b-0 hover:bg-muted/30">
                      <div className="w-64 shrink-0 border-r px-3 py-2">
                        <Link to={`/app/issues/${r.id}`} className="block truncate text-sm font-semibold hover:text-primary">
                          {r.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                          <UserAvatar
                            size="xs"
                            name={r.assignee?.full_name}
                            email={r.assignee?.email}
                            avatarUrl={r.assignee?.avatar_url}
                          />
                          <span className="truncate">{r.issue_key || r.project?.key} · {fmtType(r.issue_type)}</span>
                        </div>
                      </div>
                      <div className="relative flex flex-1 py-3">
                        {dayCells.map((_, i) => (
                          <div
                            key={i}
                            className={cn('flex-1 border-r last:border-r-0', i === todayIndex && 'bg-primary/5')}
                          />
                        ))}
                        <div
                          className={cn(
                            'absolute top-1/2 h-6 -translate-y-1/2 rounded-md border px-2 text-[0.7rem] font-semibold leading-6 text-foreground/90 shadow-sm',
                            group.bar,
                          )}
                          style={barStyle(r)}
                          title={`${r.project?.name || ''} — ${r.title}`}
                        >
                          <span className="block truncate">{r.project?.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
