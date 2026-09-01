import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { format } from 'date-fns';
import { Users, Building2, Archive, ShieldOff, Inbox, TrendingUp, Loader2, LogOut } from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Legend, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { ThemeToggle } from '@/components/Theme/ThemeToggle';
import NotFound from './NotFound';

const CHART = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
];

interface PlatformStats {
  total_users: number;
  total_workspaces: number;
  deleted_workspaces: number;
  purged_workspaces: number;
  pending_recovery_requests: number;
  workspaces_created_last_30_days: number;
  weekly_growth: { week_start: string; created: number }[];
}

interface WorkspaceRow {
  id: string;
  name: string;
  code: string;
  created_at?: string;
  deleted_at?: string | null;
  purged_at?: string | null;
}

interface RecoveryRequest {
  id: string;
  requester_email: string;
  workspace_code: string;
  reason: string;
  created_at: string;
}

const PlatformAdmin = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceRow[]>([]);
  const [deletedWorkspaces, setDeletedWorkspaces] = useState<WorkspaceRow[]>([]);
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (error) console.error('is_platform_admin check failed:', error);
      setIsPlatformAdmin(!!data);
      setChecking(false);
    });
  }, [user, authLoading]);

  const loadData = async () => {
    setLoadingData(true);
    setLoadError(null);

    const [statsRes, recentRes, deletedRes, pendingRes] = await Promise.all([
      supabase.rpc('platform_stats'),
      supabase.from('workspaces').select('id, name, code, created_at').order('created_at', { ascending: false }).limit(10),
      supabase
        .from('workspaces')
        .select('id, name, code, deleted_at, purged_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(10),
      supabase
        .from('workspace_recovery_requests')
        .select('id, requester_email, workspace_code, reason, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);

    // Surface any failure instead of silently showing zeros for everything —
    // that ambiguity (real zero vs. a swallowed error) is exactly what made
    // an earlier version of this page confusing to debug.
    const firstError = statsRes.error || recentRes.error || deletedRes.error || pendingRes.error;
    if (firstError) {
      console.error('Platform console load failed:', firstError);
      setLoadError(friendlyErrorMessage(firstError));
      setLoadingData(false);
      return;
    }

    setStats((statsRes.data as unknown as PlatformStats) ?? null);
    setRecentWorkspaces(recentRes.data ?? []);
    setDeletedWorkspaces(deletedRes.data ?? []);
    setRequests(pendingRes.data ?? []);
    setLoadingData(false);
  };

  useEffect(() => {
    if (isPlatformAdmin) loadData();
  }, [isPlatformAdmin]);

  const decide = async (requestId: string, action: 'approve' | 'reject') => {
    setDecidingId(requestId);
    const reply = replies[requestId] || (action === 'approve' ? 'Your workspace has been restored.' : 'This request was not approved.');
    const { error } = await supabase.rpc(action === 'approve' ? 'approve_recovery_request' : 'reject_recovery_request', {
      _request_id: requestId,
      _reply: reply,
    });
    if (error) {
      toast({ title: `Could not ${action} request`, description: friendlyErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: action === 'approve' ? 'Workspace restored' : 'Request rejected' });
      await loadData();
    }
    setDecidingId(null);
  };

  if (authLoading || checking) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  // Never reveal that this route is admin-only to anyone who isn't one —
  // render the same 404 a nonexistent path would show.
  if (!user || !isPlatformAdmin) {
    return <NotFound />;
  }

  const growthData = (stats?.weekly_growth ?? []).map((w) => ({
    week: format(new Date(w.week_start), 'MMM d'),
    created: w.created,
  }));

  const statusData = [
    { name: 'Active', value: stats?.total_workspaces ?? 0 },
    { name: 'Grace period', value: stats?.deleted_workspaces ?? 0 },
    { name: 'Purged', value: stats?.purged_workspaces ?? 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Loopix platform console</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Button variant="ghost" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {loadingData ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <Card className="border-destructive/30">
            <CardContent className="space-y-3 py-6 text-center">
              <p className="font-semibold text-destructive">Couldn't load platform data</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button variant="outline" onClick={loadData}>Try again</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total users" value={stats?.total_users ?? 0} icon={Users} tone="blue" />
              <StatCard label="Active workspaces" value={stats?.total_workspaces ?? 0} icon={Building2} tone="green" />
              <StatCard label="New (30d)" value={stats?.workspaces_created_last_30_days ?? 0} icon={TrendingUp} tone="sky" />
              <StatCard label="Deleted (grace period)" value={stats?.deleted_workspaces ?? 0} icon={Archive} tone="amber" />
              <StatCard label="Purged" value={stats?.purged_workspaces ?? 0} icon={ShieldOff} tone="violet" />
              <StatCard label="Pending recoveries" value={stats?.pending_recovery_requests ?? 0} icon={Inbox} tone="orange" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Workspace growth — last 8 weeks</CardTitle>
                  <CardDescription>New workspaces created, by week</CardDescription>
                </CardHeader>
                <CardContent>
                  {growthData.some((d) => d.created > 0) ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={growthData}>
                        <defs>
                          <linearGradient id="gGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, color: 'hsl(var(--popover-foreground))' }} />
                        <Area type="monotone" dataKey="created" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#gGrowth)" name="Workspaces created" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-16 text-center text-muted-foreground">No workspaces created in this window yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Workspace status</CardTitle>
                  <CardDescription>Across the whole platform</CardDescription>
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
                  ) : (
                    <p className="py-16 text-center text-muted-foreground">No workspaces yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recovery requests</CardTitle>
                <CardDescription>Review and reply — approving restores the workspace in full</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {requests.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
                {requests.map((r) => (
                  <div key={r.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{r.requester_email}</p>
                        <p className="text-sm text-muted-foreground">
                          Workspace code <span className="font-mono font-semibold">{r.workspace_code}</span> ·{' '}
                          {format(new Date(r.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <p className="rounded-md bg-muted/50 p-3 text-sm">{r.reason}</p>
                    <Textarea
                      placeholder="Reply to the requester..."
                      value={replies[r.id] ?? ''}
                      onChange={(e) => setReplies((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => decide(r.id, 'reject')}
                        disabled={decidingId === r.id}
                      >
                        Reject
                      </Button>
                      <Button onClick={() => decide(r.id, 'approve')} disabled={decidingId === r.id}>
                        {decidingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve & restore'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recently added workspaces</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentWorkspaces.map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{w.code}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {w.created_at && format(new Date(w.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                  {recentWorkspaces.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recently deleted workspaces</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deletedWorkspaces.map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{w.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={w.purged_at ? 'secondary' : 'outline'}>
                          {w.purged_at ? 'Purged' : 'Grace period'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {w.deleted_at && format(new Date(w.deleted_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  ))}
                  {deletedWorkspaces.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PlatformAdmin;
