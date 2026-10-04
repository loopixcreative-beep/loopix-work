import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { fetchAllLedgerRows, money } from '@/lib/accounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { Wallet } from 'lucide-react';

type Project = { id: string; name: string };
type Ledger = { id: string; project_id: string | null; currency: string };
type Entry = { ledger_id: string; type: string; category: string; amount: number; transaction_date: string; obligation_id: string | null };
type Obligation = { id: string; kind: 'receivable' | 'payable'; amount: number };
const db = supabase as unknown as SupabaseClient;
const colors = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Accounts() {
  const { workspace, role } = useWorkspace();
  const workspaceId = workspace?.id;
  const { toast } = useToast();
  const canManage = role === 'superadmin' || role === 'admin' || role === 'manager';
  const [projects, setProjects] = useState<Project[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [mainProjectId, setMainProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (quiet = false) => {
    if (!workspaceId || !canManage) return;
    const [p, l] = await Promise.all([
      supabase.from('projects').select('id,name').eq('workspace_id', workspaceId),
      db.from('account_ledgers').select('id,project_id,main_project_id,currency').eq('workspace_id', workspaceId),
    ]);
    if (p.error || l.error) {
      toast({ title: 'Could not load accounts', description: friendlyErrorMessage(p.error ?? l.error), variant: 'destructive' });
      setLoading(false); return;
    }
    setProjects(p.data ?? []);
    setMainProjectId((l.data ?? []).find((item: { project_id: string | null }) => !item.project_id)?.main_project_id ?? null);
    const projectLedgers = (l.data ?? []) as Ledger[];
    setLedgers(projectLedgers);
    const ids = projectLedgers.map(item => item.id);
    if (ids.length) {
      try {
        const [tx, due] = await Promise.all([
          fetchAllLedgerRows<Entry>(db, 'account_transactions', 'id,ledger_id,type,category,amount,transaction_date,obligation_id', ids),
          fetchAllLedgerRows<Obligation>(db, 'account_obligations', 'id,kind,amount', ids),
        ]);
        setEntries(tx); setObligations(due);
      } catch (error) {
        if (!quiet) { setEntries([]); setObligations([]); }
        toast({ title: 'Could not load account activity', description: friendlyErrorMessage(error), variant: 'destructive' });
      }
    } else { setEntries([]); setObligations([]); }
    setLoading(false);
  }, [workspaceId, canManage, toast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 60000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [load]);

  const summary = useMemo(() => {
    const byProject = new Map<string, { name: string; income: number; expense: number }>();
    const byCategory = new Map<string, number>();
    const byMonth = new Map<string, { month: string; income: number; expense: number }>();
    const paid = new Map<string, number>();
    let income = 0, expense = 0;
    const ledgerMap = new Map(ledgers.map(item => [item.id, item.project_id]));
    const nameMap = new Map(projects.map(item => [item.id, item.name]));
    for (const entry of entries) {
      if (entry.obligation_id) paid.set(entry.obligation_id, (paid.get(entry.obligation_id) ?? 0) + Number(entry.amount));
      if (entry.type !== 'income' && entry.type !== 'expense') continue;
      const amount = Number(entry.amount);
      const projectId = ledgerMap.get(entry.ledger_id);
      const name = projectId ? (nameMap.get(projectId) ?? 'Project') : 'Historical business account';
      const project = byProject.get(name) ?? { name, income: 0, expense: 0 };
      const monthKey = entry.transaction_date.slice(0, 7);
      const month = byMonth.get(monthKey) ?? { month: monthKey, income: 0, expense: 0 };
      if (entry.type === 'income') { income += amount; project.income += amount; month.income += amount; }
      else { expense += amount; project.expense += amount; month.expense += amount; byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + amount); }
      byProject.set(name, project); byMonth.set(monthKey, month);
    }
    let receivable = 0, payable = 0;
    for (const item of obligations) {
      const remaining = Math.max(0, Number(item.amount) - (paid.get(item.id) ?? 0));
      if (item.kind === 'receivable') receivable += remaining; else payable += remaining;
    }
    return { income, expense, receivable, payable,
      projects: [...byProject.values()].sort((a,b) => b.income - a.income),
      categories: [...byCategory].map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
      months: [...byMonth.values()].sort((a,b) => a.month.localeCompare(b.month)) };
  }, [entries, obligations, ledgers, projects]);
  const currency = ledgers[0]?.currency ?? 'NPR';
  const main = projects.find(item => item.id === mainProjectId);
  if (!canManage) return <Card><CardContent className="p-6">The account dashboard is available to workspace managers and admins.</CardContent></Card>;
  return <div className="space-y-6">
    <div><h1 className="flex items-center gap-2 text-3xl font-bold"><Wallet className="h-7 w-7 text-primary" />Accounts</h1><p className="text-muted-foreground">Live overview of the selected main project and all linked project accounts.</p></div>
    {loading ? <p className="text-muted-foreground">Loading accounts…</p> : !main ? <Card><CardContent className="space-y-2 p-6"><p className="font-semibold">Select a main project to open the account dashboard.</p><p className="text-sm text-muted-foreground">A workspace admin can choose one from any project’s Settings → Account tab.</p>{projects[0] && <Link className="text-sm text-primary underline" to={`/app/projects/${projects[0].id}/settings`}>Open project settings</Link>}</CardContent></Card> : <>
      <Card className="border-primary/25 bg-primary/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm text-muted-foreground">Main project</p><p className="text-lg font-semibold">{main.name}</p></div><Link className="text-sm font-medium text-primary hover:underline" to={`/app/projects/${main.id}/account`}>Open main project account →</Link></CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Income received', summary.income, 'text-emerald-600'],
          ['Expenses paid', summary.expense, 'text-orange-600'],
          ['Income less expenses', summary.income - summary.expense, ''],
          ['Accounts receivable', summary.receivable, 'text-blue-600'],
          ['Accounts payable', summary.payable, 'text-amber-600'],
        ].map(([label, value, tone]) => <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className={`text-xl font-bold ${tone}`}>{money(Number(value), currency)}</CardContent></Card>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Income and spending by project</CardTitle></CardHeader><CardContent className="h-72">{summary.projects.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.projects} margin={{ left: 12, right: 12 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: number) => money(v, currency)} /><Bar dataKey="income" fill="hsl(var(--chart-6))" name="Income" /><Bar dataKey="expense" fill="hsl(var(--chart-4))" name="Expense" /></BarChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">No recorded activity yet.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Where money is spent</CardTitle></CardHeader><CardContent className="h-72">{summary.categories.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.categories} dataKey="value" nameKey="name" outerRadius={95} label={({ name }) => name}>{summary.categories.map((item,i) => <Cell key={item.name} fill={colors[i % colors.length]} />)}</Pie><Tooltip formatter={(v: number) => money(v, currency)} /></PieChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">No expenses yet.</p>}</CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Monthly cash activity</CardTitle></CardHeader><CardContent className="h-64">{summary.months.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.months}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: number) => money(v, currency)} /><Bar dataKey="income" fill="hsl(var(--chart-6))" /><Bar dataKey="expense" fill="hsl(var(--chart-4))" /></BarChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">No monthly activity yet.</p>}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Project accounts</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{projects.map(item => <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted" key={item.id} to={`/app/projects/${item.id}/account`}>{item.name}</Link>)}</CardContent></Card>
    </>}
  </div>;
}
