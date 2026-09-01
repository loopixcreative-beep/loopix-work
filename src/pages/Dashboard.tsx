import { TimerToggle } from '@/components/TimeLog/TimerToggle';
import { ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatCard } from '@/components/ui/stat-card';
import {
  Plus, TrendingUp, Users, Clock, CheckCircle2, AlertCircle, Calendar, Award,
  Target, FolderKanban, Flame, ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { projectPath } from '@/lib/utils';
import { format, differenceInCalendarDays, subDays, isSameDay } from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, AreaChart, Area, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';

interface DashboardStats {
  totalProjects: number;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  reviewIssues: number;
  todoIssues: number;
  overdueIssues: number;
  myTasks: number;
  myOpenTasks: number;
  coinPoints: number;
  completedThisWeek: number;
  createdThisWeek: number;
}

interface RecentProject {
  id: string;
  name: string;
  key: string | null;
  type: string;
  progress: number;
  issueCount: number;
  overdue: number;
}

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  taskCount: number;
  done: number;
  active: number;
  overdue: number;
  coin_points: number;
}

interface UpcomingTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  status: string;
  project_name: string;
  assignee_name: string | null;
  assignee_avatar: string | null;
}

const CHART = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
];

const priorityTone = (p: string) =>
  p === 'critical' || p === 'highest' || p === 'high'
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : p === 'medium'
    ? 'bg-brand-orange/15 text-brand-orange border-brand-orange/30'
    : 'bg-primary/10 text-primary border-primary/30';

const initials = (name?: string | null, email?: string) =>
  (name?.trim()?.charAt(0) || email?.charAt(0) || '?').toUpperCase();

const Dashboard = () => {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0, totalIssues: 0, completedIssues: 0, inProgressIssues: 0,
    reviewIssues: 0, todoIssues: 0, overdueIssues: 0, myTasks: 0, myOpenTasks: 0,
    coinPoints: 0, completedThisWeek: 0, createdThisWeek: 0,
  });
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [teamActivity, setTeamActivity] = useState<TeamMember[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [priorityData, setPriorityData] = useState<{ name: string; value: number }[]>([]);
  const [typeData, setTypeData] = useState<{ name: string; value: number }[]>([]);
  const [trendData, setTrendData] = useState<{ day: string; created: number; completed: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [{ data: projects }, { data: issues }, { data: profiles }] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('issues').select('*, project:projects(name, key)'),
        supabase.from('profiles').select('id, user_id, full_name, email, avatar_url, coin_points'),
      ]);

      const all = issues || [];
      const now = new Date();
      const weekAgo = subDays(now, 7);
      const isOverdue = (i: any) => i.due_date && new Date(i.due_date) < now && i.status !== 'done';

      const completedIssues = all.filter(i => i.status === 'done').length;
      const inProgressIssues = all.filter(i => i.status === 'in_progress').length;
      const reviewIssues = all.filter(i => i.status === 'review').length;
      const todoIssues = all.filter(i => i.status === 'to_do').length;
      const myIssues = all.filter(i => i.assignee_id === user?.id);

      setStats({
        totalProjects: projects?.length || 0,
        totalIssues: all.length,
        completedIssues,
        inProgressIssues,
        reviewIssues,
        todoIssues,
        overdueIssues: all.filter(isOverdue).length,
        myTasks: myIssues.length,
        myOpenTasks: myIssues.filter(i => i.status !== 'done').length,
        coinPoints: profiles?.find(p => p.user_id === user?.id)?.coin_points || 0,
        completedThisWeek: all.filter(i => i.status === 'done' && i.updated_at && new Date(i.updated_at) >= weekAgo).length,
        createdThisWeek: all.filter(i => i.created_at && new Date(i.created_at) >= weekAgo).length,
      });

      setStatusData([
        { name: 'To Do', value: todoIssues },
        { name: 'In Progress', value: inProgressIssues },
        { name: 'In Review', value: reviewIssues },
        { name: 'Done', value: completedIssues },
      ].filter(d => d.value > 0));

      const prioOrder = ['critical', 'high', 'medium', 'low'];
      setPriorityData(
        prioOrder
          .map(p => ({ name: p.charAt(0).toUpperCase() + p.slice(1), value: all.filter(i => i.priority === p).length }))
          .filter(d => d.value > 0)
      );

      const typeCount: Record<string, number> = {};
      all.forEach(i => {
        const t = String(i.issue_type || 'task').replace(/_/g, ' ');
        typeCount[t] = (typeCount[t] || 0) + 1;
      });
      setTypeData(Object.entries(typeCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6));

      // 14 day activity trend
      const trend = Array.from({ length: 14 }).map((_, idx) => {
        const day = subDays(now, 13 - idx);
        return {
          day: format(day, 'MMM d'),
          created: all.filter(i => i.created_at && isSameDay(new Date(i.created_at), day)).length,
          completed: all.filter(i => i.status === 'done' && i.updated_at && isSameDay(new Date(i.updated_at), day)).length,
        };
      });
      setTrendData(trend);

      // Team workload
      const members = (profiles || []).map(p => {
        const mine = all.filter(i => i.assignee_id === p.user_id);
        return {
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name || p.email,
          email: p.email,
          avatar_url: p.avatar_url,
          taskCount: mine.length,
          done: mine.filter(i => i.status === 'done').length,
          active: mine.filter(i => i.status !== 'done').length,
          overdue: mine.filter(isOverdue).length,
          coin_points: p.coin_points || 0,
        };
      }).sort((a, b) => b.taskCount - a.taskCount);
      setTeamActivity(members);

      // Upcoming deadlines — all open tasks with a due date (next 30 days + overdue)
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      const upcoming = all
        .filter(i => i.due_date && i.status !== 'done' && new Date(i.due_date) <= horizon)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 8)
        .map(i => {
          const assignee = profiles?.find(p => p.user_id === i.assignee_id);
          return {
            id: i.id,
            title: i.title,
            due_date: i.due_date,
            priority: i.priority,
            status: i.status,
            project_name: (i as any).project?.name || 'Unknown',
            assignee_name: assignee?.full_name || assignee?.email || null,
            assignee_avatar: assignee?.avatar_url || null,
          };
        });
      setUpcomingTasks(upcoming);

      if (projects) {
        setRecentProjects(projects.slice(0, 6).map(project => {
          const pi = all.filter(i => i.project_id === project.id);
          const done = pi.filter(i => i.status === 'done').length;
          return {
            id: project.id,
            name: project.name,
            key: project.key,
            type: project.type,
            progress: pi.length ? Math.round((done / pi.length) * 100) : 0,
            issueCount: pi.length,
            overdue: pi.filter(isOverdue).length,
          };
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-8 w-1/2 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const completionRate = stats.totalIssues > 0 ? Math.round((stats.completedIssues / stats.totalIssues) * 100) : 0;
  const gauge = [{ name: 'completion', value: completionRate, fill: 'hsl(var(--chart-1))' }];
  const maxWorkload = Math.max(1, ...teamActivity.map(m => m.taskCount));
  const workloadChart = teamActivity.slice(0, 6).map(m => ({
    name: (m.full_name || '').split(' ')[0] || m.email.split('@')[0],
    active: m.active,
    done: m.done,
  }));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand bg-[length:200%_200%] animate-gradient-pan p-5 text-primary-foreground shadow-stat sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
              {workspace && (
                <span
                  className="rounded-full bg-primary-foreground/15 px-2.5 py-1 font-mono text-xs font-bold tracking-[0.15em]"
                  title={workspace.name}
                >
                  {workspace.code}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-primary-foreground/85 sm:text-base">
              {stats.myOpenTasks} open task{stats.myOpenTasks === 1 ? '' : 's'} assigned to you · {stats.completedThisWeek} completed across the team this week
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TimerToggle variant="hero" />
            <Button variant="secondary" asChild>
              <Link to="/app/my-tasks"><ListChecks className="mr-2 h-4 w-4" />My Tasks</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/app/issues/new"><Plus className="mr-2 h-4 w-4" />New Task</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/app/projects/new"><FolderKanban className="mr-2 h-4 w-4" />New Project</Link>
            </Button>
          </div>

        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-orb-float rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 animate-orb-float-slow rounded-full bg-primary-foreground/10 blur-2xl" />
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">

        <StatCard label="Projects" value={stats.totalProjects} hint="Active workspaces" icon={FolderKanban} tone="blue" />
        <StatCard label="Tasks" value={stats.totalIssues} hint={`${stats.createdThisWeek} new this week`} icon={Target} tone="sky" />
        <StatCard label="Completed" value={stats.completedIssues} hint={`${completionRate}% completion`} icon={CheckCircle2} tone="green" progress={completionRate} />
        <StatCard label="In Progress" value={stats.inProgressIssues} hint="Being worked on" icon={Clock} tone="orange" />
        <StatCard label="In Review" value={stats.reviewIssues} hint="Awaiting approval" icon={AlertCircle} tone="amber" />
        <StatCard label="Overdue" value={stats.overdueIssues} hint="Past due date" icon={Flame} tone="violet" />
        <StatCard label="My Tasks" value={stats.myTasks} hint={`${stats.myOpenTasks} still open`} icon={Users} tone="blue" />
        <StatCard label="Coin Points" value={stats.coinPoints} hint="Earned by you" icon={Award} tone="orange" />
      </div>

      {/* Trend + gauge */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Task Flow — last 14 days</CardTitle>
            <CardDescription>Created vs completed tasks across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, color: 'hsl(var(--popover-foreground))' }} />
                <Legend />
                <Area type="monotone" dataKey="created" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#gCreated)" name="Created" />
                <Area type="monotone" dataKey="completed" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#gDone)" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
            <CardDescription>Completion across every task</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={gauge} startAngle={210} endAngle={-30}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">{completionRate}%</span>
                <span className="text-sm text-muted-foreground">completed</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 p-2">
                <p className="text-lg font-bold">{stats.todoIssues}</p>
                <p className="text-xs text-muted-foreground">To Do</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <p className="text-lg font-bold">{stats.inProgressIssues}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <p className="text-lg font-bold">{stats.completedIssues}</p>
                <p className="text-xs text-muted-foreground">Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution charts */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>Where work currently sits</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="py-16 text-center text-muted-foreground">No task data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Mix</CardTitle>
            <CardDescription>Task urgency distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {priorityData.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-16 text-center text-muted-foreground">No task data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Types</CardTitle>
            <CardDescription>Most common work items</CardDescription>
          </CardHeader>
          <CardContent>
            {typeData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={typeData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-16 text-center text-muted-foreground">No task data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Projects + deadlines */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Latest projects and their progress</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/projects">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
                <Button asChild><Link to="/app/projects/new"><Plus className="mr-2 h-4 w-4" />Create Project</Link></Button>
              </div>
            ) : (
              <div className="divide-y">
                {recentProjects.map(project => (
                  <Link key={project.id} to={projectPath(project.id, project.name)} className="flex items-center gap-4 py-3 transition-colors hover:bg-muted/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {(project.key || project.name).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold leading-none">{project.name}</p>
                        <Badge variant="secondary" className="text-xs">{project.type.replace(/_/g, ' ')}</Badge>
                        {project.overdue > 0 && <Badge variant="destructive" className="text-xs">{project.overdue} overdue</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="h-2 flex-1" />
                        <span className="w-10 text-right text-xs text-muted-foreground">{project.progress}%</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">{project.issueCount}</p>
                      <p className="text-xs text-muted-foreground">tasks</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Open tasks due within the next 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No upcoming deadlines</h3>
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y">
                {upcomingTasks.map(task => {
                  const days = differenceInCalendarDays(new Date(task.due_date), new Date());
                  const late = days < 0;
                  return (
                    <li key={task.id}>
                      <Link to={`/app/issues/${task.id}`} className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/50">
                        <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border ${late ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-primary'}`}>
                          <span className="text-xs font-semibold uppercase leading-none">{format(new Date(task.due_date), 'MMM')}</span>
                          <span className="text-base font-bold leading-none">{format(new Date(task.due_date), 'd')}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold leading-tight">{task.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {task.project_name} · {late ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `in ${days}d`}
                            {task.assignee_name ? ` · ${task.assignee_name}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline" className={`text-xs capitalize ${priorityTone(task.priority)}`}>{task.priority}</Badge>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={task.assignee_avatar || undefined} alt={task.assignee_name || 'Unassigned'} />
                            <AvatarFallback className="text-xs">{initials(task.assignee_name, '?')}</AvatarFallback>
                          </Avatar>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team activity & workload */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Team Activity & Workload</CardTitle>
            <CardDescription>Who is carrying what across the workspace</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/teams">View team <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {teamActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No team activity</h3>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {teamActivity.map(m => (
                  <div key={m.id} className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-3">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.avatar_url || undefined} alt={m.full_name} />
                      <AvatarFallback className="text-xs">{initials(m.full_name, m.email)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold">{m.full_name}</span>
                    <Badge variant="secondary" className="text-xs">{m.active}</Badge>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Active vs completed</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={workloadChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} />
                      <Legend />
                      <Bar dataKey="active" stackId="a" fill="hsl(var(--chart-1))" name="Active" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="done" stackId="a" fill="hsl(var(--chart-2))" name="Completed" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Workload leaderboard</p>
                  {teamActivity.slice(0, 6).map(member => (
                    <div key={member.id} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url || undefined} alt={member.full_name} />
                        <AvatarFallback>{initials(member.full_name, member.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{member.full_name}</p>
                          {member.overdue > 0 && <Badge variant="destructive" className="text-xs">{member.overdue} late</Badge>}
                          <Badge variant="outline" className="ml-auto text-xs"><Award className="mr-1 h-3 w-3" />{member.coin_points}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-brand transition-all duration-700" style={{ width: `${(member.taskCount / maxWorkload) * 100}%` }} />
                          </div>
                          <span className="w-24 text-right text-xs text-muted-foreground">{member.active} active / {member.done} done</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/app/projects/new"><Plus className="mr-2 h-4 w-4" />Create Project</Link>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/app/content-calendar"><Calendar className="mr-2 h-4 w-4" />Content Calendar</Link>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/app/teams"><Users className="mr-2 h-4 w-4" />View Teams</Link>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/app/reports"><TrendingUp className="mr-2 h-4 w-4" />View Reports</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
