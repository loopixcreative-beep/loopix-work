import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, User, Clock, AlertCircle, GripVertical, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AssigneesList } from '@/components/Issue/AssigneesList';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

interface Issue {
  id: string;
  issue_key: string;
  title: string;
  status: string;
  priority: string;
  issue_type: string;
  assignee_id: string | null;
  due_date: string | null;
  assignee: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface KanbanBoardProps {
  projectId: string;
}

const columns = [
  { id: 'to_do', title: 'To Do', dot: 'bg-muted-foreground', accent: 'border-t-muted-foreground/50' },
  { id: 'in_progress', title: 'In Progress', dot: 'bg-chart-1', accent: 'border-t-chart-1' },
  { id: 'review', title: 'In Review', dot: 'bg-chart-4', accent: 'border-t-chart-4' },
  { id: 'done', title: 'Done', dot: 'bg-chart-6', accent: 'border-t-chart-6' },
];

const PAGE_SIZE = 15;

const KanbanBoard = ({ projectId }: KanbanBoardProps) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string[]>>({});
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchIssues();
  }, [projectId]);

  // Re-paginate from the top whenever the filtered set changes underneath the columns.
  useEffect(() => {
    setVisibleCounts({});
  }, [search, assigneeFilter, priorityFilter, projectId]);

  const fetchIssues = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          assignee:profiles!issues_assignee_id_fkey(full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = data || [];
      setIssues(rows);

      const ids = rows.map(r => r.id);
      if (ids.length) {
        const { data: links } = await supabase
          .from('issue_assignees')
          .select('issue_id, user_id')
          .in('issue_id', ids);
        const map: Record<string, string[]> = {};
        (links || []).forEach(l => {
          map[l.issue_id] = [...(map[l.issue_id] || []), l.user_id];
        });
        setAssigneeMap(map);

        const userIds = Array.from(
          new Set([
            ...(links || []).map(l => l.user_id),
            ...rows.map(r => r.assignee_id).filter(Boolean) as string[],
          ]),
        );
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);
          setMembers(
            (profiles || []).map(p => ({ user_id: p.user_id, name: p.full_name || p.email })),
          );
        }
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };


  const moveIssue = async (issueId: string, newStatus: string) => {
    const current = issues.find(i => i.id === issueId);
    if (!current || current.status === newStatus) return;

    const previous = issues;
    setIssues(prev => prev.map(i => (i.id === issueId ? { ...i, status: newStatus } : i)));

    const { error } = await supabase
      .from('issues')
      .update({ status: newStatus as any })
      .eq('id', issueId);

    if (error) {
      setIssues(previous);
      toast({
        title: 'Could not move task',
        description: friendlyErrorMessage(error),
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Task updated',
        description: `${current.issue_key} moved to ${columns.find(c => c.id === newStatus)?.title}`,
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
      case 'highest':
        return 'bg-destructive/15 text-destructive border-destructive/30';
      case 'high':
        return 'bg-brand-orange/15 text-brand-orange border-brand-orange/30';
      case 'medium':
        return 'bg-chart-4/15 text-chart-4 border-chart-4/30';
      default:
        return 'bg-primary/10 text-primary border-primary/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'story':
        return <User className="h-4 w-4 text-chart-6" />;
      case 'task':
        return <Clock className="h-4 w-4 text-chart-1" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const matchesFilters = (issue: Issue) => {
    if (assigneeFilter !== 'all') {
      const extra = assigneeMap[issue.id] || [];
      if (issue.assignee_id !== assigneeFilter && !extra.includes(assigneeFilter)) return false;
    }
    if (priorityFilter !== 'all' && issue.priority !== priorityFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      issue.title.toLowerCase().includes(q) ||
      (issue.issue_key || '').toLowerCase().includes(q) ||
      ((issue as unknown as { description?: string }).description || '').toLowerCase().includes(q)
    );
  };

  const getIssuesForColumn = (status: string) =>
    issues.filter(issue => issue.status === status && matchesFilters(issue));

  const filterBar = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks by title, key or description..."
          className="h-9 w-[260px] pl-8"
        />
      </div>
      <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
        <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Member" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All members</SelectItem>
          {members.map(m => (
            <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          {['highest', 'high', 'medium', 'low', 'lowest'].map(p => (
            <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(search || assigneeFilter !== 'all' || priorityFilter !== 'all') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSearch(''); setAssigneeFilter('all'); setPriorityFilter('all'); }}
        >
          Clear
        </Button>
      )}
    </div>
  );


  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {columns.map(column => (
          <Card key={column.id} className="h-96">
            <CardHeader className="pb-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded bg-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      {filterBar}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

      {columns.map(column => {
        const allColumnIssues = getIssuesForColumn(column.id);
        const visibleCount = visibleCounts[column.id] ?? PAGE_SIZE;
        const columnIssues = allColumnIssues.slice(0, visibleCount);
        const remaining = allColumnIssues.length - columnIssues.length;
        const isOver = dragOverColumn === column.id;

        return (
          <Card
            key={column.id}
            className={cn(
              'flex flex-col border-t-4 transition-colors',
              column.accent,
              isOver && 'bg-primary/5 ring-2 ring-primary/40'
            )}
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverColumn !== column.id) setDragOverColumn(column.id);
            }}
            onDragLeave={() => setDragOverColumn(prev => (prev === column.id ? null : prev))}
            onDrop={e => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain') || draggingId;
              setDragOverColumn(null);
              setDraggingId(null);
              if (id) moveIssue(id, column.id);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-sm font-semibold">
                  <div className={cn('h-2.5 w-2.5 rounded-full', column.dot)} />
                  <span>{column.title}</span>
                  <Badge variant="secondary" className="text-xs">{allColumnIssues.length}</Badge>
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/app/projects/${projectId}/issues/new?status=${column.id}`}>
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="min-h-[220px] flex-1 space-y-3">
              {columnIssues.map(issue => (
                <Card
                  key={issue.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', issue.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingId(issue.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverColumn(null);
                  }}
                  className={cn(
                    'group cursor-grab transition-all hover:-translate-y-0.5 hover:shadow-stat active:cursor-grabbing',
                    draggingId === issue.id && 'opacity-50'
                  )}
                >
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <span className="font-mono text-xs font-semibold text-primary">{issue.issue_key}</span>
                          <Link
                            to={`/app/projects/${projectId}/issues/${issue.id}`}
                            className="line-clamp-2 block text-sm font-semibold leading-tight hover:underline"
                          >
                            {issue.title}
                          </Link>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {getTypeIcon(issue.issue_type)}
                          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={cn('text-xs capitalize', getPriorityColor(issue.priority))}>
                          {issue.priority}
                        </Badge>
                        <AssigneesList issueId={issue.id} />
                      </div>

                      {issue.due_date && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Due {format(new Date(issue.due_date), 'MMM dd')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {remaining > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    setVisibleCounts(prev => ({ ...prev, [column.id]: visibleCount + PAGE_SIZE }))
                  }
                >
                  See more ({remaining} more)
                </Button>
              )}

              {allColumnIssues.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
                  <p className="text-sm">Drop tasks here</p>
                  <Button variant="ghost" size="sm" className="mt-2" asChild>
                    <Link to={`/app/projects/${projectId}/issues/new?status=${column.id}`}>
                      <Plus className="mr-1 h-4 w-4" />
                      Add issue
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );

};

export default KanbanBoard;
