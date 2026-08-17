import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { TimerToggle } from '@/components/TimeLog/TimerToggle';
import { PresenceAvatar } from '@/components/ui/presence-avatar';
import { formatDuration, useWorkTimer } from '@/hooks/useWorkTimer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, CalendarClock, Timer, Users } from 'lucide-react';
import { format, startOfWeek, startOfMonth, startOfDay, isSameDay, addDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
}

interface Person {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  team_department: string | null;
}

const WEEKLY_TARGET_HOURS = 40;

const TimeLog = () => {
  const { user } = useAuth();
  const { running, elapsed, workingUsers, onlineUsers } = useWorkTimer();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamRange, setTeamRange] = useState<'today' | 'week' | 'month'>('today');
  const [visibleSessionCount, setVisibleSessionCount] = useState(10);

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 0 }), []);
  const monthStart = useMemo(() => startOfMonth(new Date()), []);

  // Load a window wide enough to cover "This month" (and a bit of history for
  // the "My sessions" list) instead of just the last 3 weeks — a narrower
  // window was why the team status card used to show ~0.0h for everyone.
  const loadWindowStart = useMemo(() => addDays(new Date(), -90), []);

  const load = useCallback(async () => {
    const [{ data: sessionData }, { data: profileData }] = await Promise.all([
      supabase
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds, note')
        .gte('started_at', loadWindowStart.toISOString())
        .order('started_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name, email, avatar_url, team_department'),
    ]);
    setSessions((sessionData || []) as SessionRow[]);
    setPeople((profileData || []) as Person[]);
    setLoading(false);
  }, [loadWindowStart]);

  useEffect(() => {
    load();
  }, [load, running]);

  const secondsOf = (s: SessionRow) =>
    s.duration_seconds ??
    Math.max(0, Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000));

  const mySessions = sessions.filter((s) => s.user_id === user?.id);
  const todaySessions = mySessions.filter((s) => isSameDay(new Date(s.started_at), new Date()));
  const todaySeconds = todaySessions.reduce((sum, s) => sum + secondsOf(s), 0);

  // Pagination resets automatically if the tab stays open across midnight —
  // the list only ever shows today's sessions, so a new day means a fresh list.
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  useEffect(() => {
    setVisibleSessionCount(10);
  }, [todayKey]);
  const weekSessions = mySessions.filter((s) => new Date(s.started_at) >= weekStart);
  const weekSeconds = weekSessions.reduce((sum, s) => sum + secondsOf(s), 0);
  const avgSession = weekSessions.length ? weekSeconds / weekSessions.length : 0;

  const weekChart = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const total = mySessions
      .filter((s) => isSameDay(new Date(s.started_at), day))
      .reduce((sum, s) => sum + secondsOf(s), 0);
    return { day: format(day, 'EEE'), hours: Number((total / 3600).toFixed(2)) };
  });

  const teamRangeStart =
    teamRange === 'today' ? startOfDay(new Date()) : teamRange === 'week' ? weekStart : monthStart;

  const teamStatus = people
    .map((p) => {
      const total = sessions
        .filter((s) => s.user_id === p.user_id && new Date(s.started_at) >= teamRangeStart)
        .reduce((sum, s) => sum + secondsOf(s), 0);
      return { ...p, seconds: total, working: workingUsers.has(p.user_id), online: onlineUsers.has(p.user_id) };
    })
    .sort((a, b) => Number(b.working) - Number(a.working) || b.seconds - a.seconds);

  const activeNow = teamStatus.filter((p) => p.working).length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand bg-[length:200%_200%] p-5 text-primary-foreground shadow-stat animate-gradient-pan sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Time Log</h1>
            <p className="mt-1 text-sm opacity-90">
              {running
                ? `You have been working for ${formatDuration(elapsed)}`
                : 'Start your timer to track today’s working hours'}
            </p>
          </div>
          <TimerToggle variant="hero" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={formatDuration(todaySeconds)} hint="Tracked today" icon={Clock} tone="blue" />
        <StatCard label="This week" value={`${(weekSeconds / 3600).toFixed(1)}h`} hint={`Target ${WEEKLY_TARGET_HOURS}h`} icon={CalendarClock} tone="orange" progress={Math.min(100, (weekSeconds / 3600 / WEEKLY_TARGET_HOURS) * 100)} />
        <StatCard label="Sessions" value={weekSessions.length} hint={`Avg ${formatDuration(avgSession)}`} icon={Timer} tone="sky" />
        <StatCard label="Working now" value={activeNow} hint={`${onlineUsers.size} online`} icon={Users} tone="green" />

      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly time insights</CardTitle>
            <CardDescription>
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm font-semibold">
                <span>Reported hours</span>
                <span>
                  {(weekSeconds / 3600).toFixed(1)}h / {WEEKLY_TARGET_HOURS}h
                </span>
              </div>
              <Progress value={Math.min(100, (weekSeconds / 3600 / WEEKLY_TARGET_HOURS) * 100)} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" unit="h" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                    }}
                    formatter={(v: number) => [`${v}h`, 'Tracked']}
                  />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Team status</CardTitle>
                <CardDescription>Green means their timer is running</CardDescription>
              </div>
              <Select value={teamRange} onValueChange={(v) => setTeamRange(v as typeof teamRange)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[26rem] space-y-3 overflow-y-auto">
            {teamStatus.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3">
                <PresenceAvatar
                  userId={p.user_id}
                  name={p.full_name}
                  email={p.email}
                  avatarUrl={p.avatar_url}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.full_name || p.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.team_department || 'Team member'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-bold tabular-nums">
                    {(p.seconds / 3600).toFixed(1)}h
                  </p>
                  <Badge
                    variant="outline"
                    className={
                      p.working
                        ? 'border-chart-2/40 bg-chart-2/10 text-chart-2'
                        : p.online
                          ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'text-muted-foreground'
                    }
                  >
                    {p.working ? 'Working' : p.online ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>
            ))}
            {teamStatus.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No team members yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My sessions</CardTitle>
          <CardDescription>Today's work sessions — resets each new day</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}
          {!loading && todaySessions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sessions yet today — hit “Start working” to log your first one.
            </p>
          )}
          {todaySessions.slice(0, visibleSessionCount).map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {format(new Date(s.started_at), 'EEE, MMM d')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(s.started_at), 'h:mm a')} –{' '}
                  {s.ended_at ? format(new Date(s.ended_at), 'h:mm a') : 'running'}
                  {s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
              <Badge variant={s.ended_at ? 'secondary' : 'default'} className="font-mono">
                {formatDuration(secondsOf(s))}
              </Badge>
            </div>
          ))}
          {todaySessions.length > visibleSessionCount && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setVisibleSessionCount((n) => n + 10)}
            >
              See more ({todaySessions.length - visibleSessionCount} more)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeLog;
