import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { money } from '@/lib/accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, RefreshCw } from 'lucide-react';

type Budget = { id: string; employee_id: string; budget_amount: number };
type Payment = { id: string; ledger_id: string; employee_budget_id: string | null; amount: number; transaction_id: string; transaction_date: string; type: string; category: string; remarks: string };
const db = supabase as unknown as SupabaseClient;
const today = () => new Date().toISOString().slice(0, 10);
const cents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export default function ProjectTeamBudget({ projectId, onPaymentRecorded }: { projectId: string; onPaymentRecorded?: () => void | Promise<void> }) {
  const { user } = useAuth();
  const { workspace, role, members, refreshMembers } = useWorkspace();
  const { toast } = useToast();
  const canEdit = role === 'admin' || role === 'superadmin' || role === 'manager';
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unlinkedTransactions, setUnlinkedTransactions] = useState<Payment[]>([]);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('NPR');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selected, setSelected] = useState<Budget | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'new' | 'existing'>('new');
  const [existingTransactionId, setExistingTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [remarks, setRemarks] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const settingResult = await db.from('project_budget_settings').select('visible').eq('project_id', projectId).maybeSingle();
      if (settingResult.error) throw settingResult.error;
      const nextVisible = settingResult.data?.visible ?? false;
      setVisible(nextVisible);
      if (!nextVisible) {
        setBudgets([]);
        setPayments([]);
        setUnlinkedTransactions([]);
        setSourceNames({});
        return;
      }
      const [budgetResult, ledgerResult] = await Promise.all([
        db.from('project_employee_budgets').select('id,employee_id,budget_amount').eq('project_id', projectId),
        db.from('account_ledgers').select('id,currency').eq('project_id', projectId).maybeSingle(),
      ]);
      if (budgetResult.error) throw budgetResult.error;
      if (ledgerResult.error) throw ledgerResult.error;
      const nextBudgets = (budgetResult.data ?? []) as Budget[];
      let ledger = ledgerResult.data;
      if (!ledger && canEdit && workspace) {
        const created = await db.from('account_ledgers').insert({ workspace_id: workspace.id,
          project_id: projectId, name: 'Project account' }).select('id,currency').single();
        if (created.error?.code === '23505') {
          const existing = await db.from('account_ledgers').select('id,currency').eq('project_id', projectId).single();
          if (existing.error) throw existing.error;
          ledger = existing.data;
        } else if (created.error) throw created.error;
        else ledger = created.data;
      }
      setBudgets(nextBudgets);
      setLedgerId(ledger?.id ?? null);
      setCurrency(ledger?.currency ?? 'NPR');
      const linked: Payment[] = [];
      if (nextBudgets.length) {
        for (let start = 0; ; start += 500) {
          const result = await db.from('account_transactions')
            .select('id,ledger_id,employee_budget_id,amount,transaction_id,transaction_date,type,category,remarks')
            .in('employee_budget_id', nextBudgets.map(budget => budget.id)).order('id').range(start, start + 499);
          if (result.error) throw result.error;
          linked.push(...((result.data ?? []) as Payment[]));
          if ((result.data ?? []).length < 500) break;
        }
      }
      setPayments(linked);
      if (canEdit && workspace) {
        const allLedgers = await db.from('account_ledgers').select('id,project_id,currency').eq('workspace_id', workspace.id);
        if (allLedgers.error) throw allLedgers.error;
        const ledgers = ((allLedgers.data ?? []) as { id: string; project_id: string | null; currency: string }[])
          .filter(item => item.currency === (ledger?.currency ?? 'NPR'));
        const ids = ledgers.map(item => item.id);
        const unlinked: Payment[] = [];
        if (ids.length) for (let start = 0; ; start += 500) {
          const result = await db.from('account_transactions')
            .select('id,ledger_id,employee_budget_id,amount,transaction_id,transaction_date,type,category,remarks')
            .in('ledger_id', ids).eq('type', 'expense').is('employee_budget_id', null)
            .order('id').range(start, start + 499);
          if (result.error) throw result.error;
          unlinked.push(...((result.data ?? []) as Payment[]));
          if ((result.data ?? []).length < 500) break;
        }
        setUnlinkedTransactions(unlinked);
        const projectIds = ledgers.map(item => item.project_id).filter((id): id is string => !!id);
        const projectResult = projectIds.length
          ? await supabase.from('projects').select('id,name').in('id', projectIds)
          : { data: [] as { id: string; name: string }[], error: null };
        if (projectResult.error) throw projectResult.error;
        const projectNames = new Map((projectResult.data ?? []).map(item => [item.id, item.name]));
        setSourceNames(Object.fromEntries(ledgers.map(item => [item.id,
          item.project_id ? (projectNames.get(item.project_id) ?? 'Project') : 'Business account'])));
      } else { setUnlinkedTransactions([]); setSourceNames({}); }
      if (nextBudgets.length) {
        const profileResult = await supabase.from('profiles').select('user_id,full_name,email')
          .in('user_id', nextBudgets.map(budget => budget.employee_id));
        if (profileResult.error) throw profileResult.error;
        setNames(Object.fromEntries((profileResult.data ?? []).map(profile => [
          profile.user_id, profile.full_name || profile.email || 'Team member',
        ])));
      } else setNames({});
    } catch (error) {
      toast({ title: 'Team budgets unavailable', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally { setLoading(false); }
  }, [projectId, canEdit, workspace, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (canEdit) void refreshMembers(); }, [canEdit, refreshMembers]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const paidByBudget = useMemo(() => payments.reduce<Record<string, number>>((totals, payment) => {
    if (payment.employee_budget_id) totals[payment.employee_budget_id] = fromCents(
      cents(totals[payment.employee_budget_id] ?? 0) + cents(Number(payment.amount)));
    return totals;
  }, {}), [payments]);
  const linkableTransactions = useMemo(() => {
    if (!selected) return [];
    const remainingCents = cents(Number(selected.budget_amount)) - cents(paidByBudget[selected.id] ?? 0);
    return unlinkedTransactions.filter(item => cents(Number(item.amount)) <= remainingCents)
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.transaction_id.localeCompare(a.transaction_id));
  }, [selected, paidByBudget, unlinkedTransactions]);
  const totals = useMemo(() => ({
    budget: fromCents(budgets.reduce((sum, budget) => sum + cents(Number(budget.budget_amount)), 0)),
    paid: fromCents(budgets.reduce((sum, budget) => sum + cents(paidByBudget[budget.id] ?? 0), 0)),
  }), [budgets, paidByBudget]);
  const available = members.filter(member => !budgets.some(budget => budget.employee_id === member.user_id))
    .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));

  const setVisibility = async () => {
    setSaving(true);
    try {
      const nextVisible = !visible;
      const result = await db.from('project_budget_settings').upsert({ project_id: projectId, visible: nextVisible },
        { onConflict: 'project_id' }).select('visible').single();
      if (result.error) throw result.error;
      setVisible(result.data.visible);
      if (nextVisible) await load(true);
      toast({ title: nextVisible ? 'Team budgets shown' : 'Team budgets hidden' });
    } catch (error) {
      toast({ title: 'Could not change budget visibility', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openBudget = (budget: Budget | null) => {
    setSelected(budget);
    setEmployeeId(budget?.employee_id ?? '');
    setBudgetAmount(budget ? String(budget.budget_amount) : '');
    setBudgetOpen(true);
  };

  const saveBudget = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(budgetAmount);
    if (!employeeId || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    try {
      const result = selected
        ? await db.from('project_employee_budgets').update({ budget_amount: amount }).eq('id', selected.id)
        : await db.from('project_employee_budgets').insert({ project_id: projectId, employee_id: employeeId,
          budget_amount: amount, created_by: user?.id });
      if (result.error) throw result.error;
      setBudgetOpen(false);
      await load(true);
      toast({ title: selected ? 'Budget updated' : 'Employee budget added' });
    } catch (error) {
      toast({ title: 'Could not save budget', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openPayment = (budget: Budget) => {
    setSelected(budget);
    setPaymentAmount('');
    setPaymentMode('new');
    setExistingTransactionId('');
    setPaymentDate(today());
    setRemarks('');
    setPaymentOpen(true);
  };

  const savePayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !ledgerId) return;
    const remainingCents = cents(Number(selected.budget_amount)) - cents(paidByBudget[selected.id] ?? 0);
    const existing = unlinkedTransactions.find(item => item.id === existingTransactionId);
    const amount = paymentMode === 'existing' ? Number(existing?.amount) : Number(paymentAmount);
    if ((paymentMode === 'existing' && (!existing || existing.type !== 'expense'))
      || !Number.isFinite(amount) || cents(amount) <= 0 || cents(amount) > remainingCents) {
      toast({ title: 'Enter an amount within the remaining budget', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (paymentMode === 'existing' && existing) {
        const result = await db.from('account_transactions').update({ employee_budget_id: selected.id })
          .eq('id', existing.id).eq('ledger_id', existing.ledger_id).is('employee_budget_id', null).select('id').maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new Error('This transaction is no longer available. Refresh and choose another.');
      } else {
        const result = await db.from('account_transactions').insert({ ledger_id: ledgerId,
          transaction_date: paymentDate, type: 'expense', category: 'Project-based team payments',
          amount, remarks, employee_budget_id: selected.id, created_by: user?.id });
        if (result.error) throw result.error;
      }
      setPaymentOpen(false);
      await load(true);
      await onPaymentRecorded?.();
      toast({ title: paymentMode === 'existing' ? 'Existing payment linked without adding another expense' : 'Payment recorded in the project and main accounts' });
    } catch (error) {
      toast({ title: 'Could not record payment', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (!visible) {
    if (!canEdit) return null;
    return <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
      <div><CardTitle>Project-based team budgets</CardTitle><CardDescription>Hidden for this project. Show it when project-based pay is needed.</CardDescription></div>
      <Button variant="outline" size="sm" disabled={saving || loading} onClick={() => void setVisibility()}>Show budgets</Button>
    </CardHeader></Card>;
  }

  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
      <div><CardTitle>Project-based team budgets</CardTitle>
        <CardDescription>Optional allocations for team members paid by project. Only recorded payments affect cash.</CardDescription></div>
      {canEdit && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => void setVisibility()}>Hide section</Button><Button size="sm" onClick={() => openBudget(null)} disabled={!available.length}><Plus className="mr-2 h-4 w-4" />Add budget</Button></div>}
    </CardHeader>
    <CardContent className="space-y-5">
      {loading ? <p className="text-sm text-muted-foreground">Loading team budgets…</p> : <>
        {budgets.length > 0 && <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Allocated</p><p className="font-semibold">{money(totals.budget, currency)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Paid to date</p><p className="font-semibold">{money(totals.paid, currency)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Remaining budget</p><p className="font-semibold">{money(fromCents(cents(totals.budget) - cents(totals.paid)), currency)}</p></div>
        </div>}
        {!budgets.length ? <p className="text-sm text-muted-foreground">No project-based budgets set. Add one only when this project uses project-based pay.</p>
          : <div className="space-y-3">{budgets.map(budget => {
            const paid = paidByBudget[budget.id] ?? 0;
            const remaining = fromCents(cents(Number(budget.budget_amount)) - cents(paid));
            const percent = Number(budget.budget_amount) ? Math.min(100, paid / Number(budget.budget_amount) * 100) : 0;
            const history = payments.filter(payment => payment.employee_budget_id === budget.id)
              .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
            return <div key={budget.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{names[budget.employee_id] || members.find(member => member.user_id === budget.employee_id)?.full_name || 'Team member'}</p>
                <p className="text-sm text-muted-foreground">{money(paid, currency)} received of {money(Number(budget.budget_amount), currency)} · {money(remaining, currency)} remaining</p></div>
                {canEdit && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openBudget(budget)}>Edit budget</Button><Button size="sm" onClick={() => openPayment(budget)} disabled={!ledgerId || remaining <= 0}>Record payment</Button></div>}</div>
              <div className="flex items-center gap-3"><Progress value={percent} className="h-2 [&>div]:bg-chart-6" /><span className="w-12 text-right text-sm font-medium">{percent.toFixed(0)}%</span></div>
              {history.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">{history.length} recorded payment{history.length === 1 ? '' : 's'}</summary>
                <div className="mt-2 space-y-1">{history.map(payment => <div key={payment.id} className="flex justify-between gap-3"><span>{payment.transaction_date} · {payment.transaction_id} · {payment.category}</span><span>{money(Number(payment.amount), currency)}</span></div>)}</div></details>}
            </div>;
          })}</div>}
      </>}
      <Button variant="ghost" size="sm" onClick={() => void load(true)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </CardContent>

    <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}><DialogContent><DialogHeader><DialogTitle>{selected ? 'Edit employee budget' : 'Add employee budget'}</DialogTitle></DialogHeader>
      <form onSubmit={saveBudget} className="space-y-4"><div className="space-y-2"><Label>Team member</Label>
        {selected ? <p className="text-sm">{names[selected.employee_id] || 'Team member'}</p> : <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder="Choose team member" /></SelectTrigger><SelectContent>{available.map(member => <SelectItem key={member.user_id} value={member.user_id}>{member.full_name || member.email}</SelectItem>)}</SelectContent></Select>}</div>
        <div className="space-y-2"><Label htmlFor="team-budget-amount">Allocated budget ({currency})</Label><Input id="team-budget-amount" required type="number" min={selected ? (paidByBudget[selected.id] ?? 0.01) : 0.01} step="0.01" value={budgetAmount} onChange={event => setBudgetAmount(event.target.value)} /></div>
        <Button type="submit" disabled={saving || !employeeId}>{saving ? 'Saving…' : 'Save budget'}</Button></form></DialogContent></Dialog>

    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Record project payment</DialogTitle></DialogHeader>
      <form onSubmit={savePayment} className="space-y-4"><p className="text-sm text-muted-foreground">{selected ? names[selected.employee_id] : ''} · {money(selected ? fromCents(cents(Number(selected.budget_amount)) - cents(paidByBudget[selected.id] ?? 0)) : 0, currency)} remaining</p>
        <div className="space-y-2"><Label>Payment source</Label><Select value={paymentMode} onValueChange={(value: 'new' | 'existing') => { setPaymentMode(value); setExistingTransactionId(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Record a new payment</SelectItem><SelectItem value="existing">Link an existing expense transaction</SelectItem></SelectContent></Select></div>
        {paymentMode === 'existing' ? <><p className="text-sm text-muted-foreground">Choose an unlinked expense from any account in this workspace. Its original transaction ID and cash balance stay unchanged.</p>
          <div className="space-y-2"><Label>Existing transaction</Label><Select value={existingTransactionId} onValueChange={setExistingTransactionId}><SelectTrigger><SelectValue placeholder="Choose an expense transaction" /></SelectTrigger><SelectContent className="max-w-[calc(100vw-2rem)]">{linkableTransactions.map(item => <SelectItem key={item.id} value={item.id}>{item.transaction_id} · {money(Number(item.amount), currency)} · {sourceNames[item.ledger_id]}</SelectItem>)}{!linkableTransactions.length && <p className="px-3 py-2 text-sm text-muted-foreground">No eligible expense transactions</p>}</SelectContent></Select></div>
          {existingTransactionId && <p className="rounded-md border p-2 text-sm text-muted-foreground">{unlinkedTransactions.find(item => item.id === existingTransactionId)?.transaction_date} · {unlinkedTransactions.find(item => item.id === existingTransactionId)?.category} · {unlinkedTransactions.find(item => item.id === existingTransactionId)?.remarks || 'No remarks'}</p>}
          {!linkableTransactions.length && <p className="text-sm text-muted-foreground">No unlinked expense fits the remaining budget. Check the amount or record a new payment.</p>}</>
          : <><div className="space-y-2"><Label htmlFor="team-payment-amount">Amount ({currency})</Label><Input id="team-payment-amount" required type="number" min="0.01" max={selected ? fromCents(cents(Number(selected.budget_amount)) - cents(paidByBudget[selected.id] ?? 0)) : undefined} step="0.01" value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="team-payment-date">Payment date</Label><Input id="team-payment-date" required type="date" value={paymentDate} onChange={event => setPaymentDate(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="team-payment-remarks">Remarks</Label><Textarea id="team-payment-remarks" value={remarks} onChange={event => setRemarks(event.target.value)} placeholder="What was this payment for?" /></div></>}
        <Button type="submit" disabled={saving || (paymentMode === 'existing' && !existingTransactionId)}>{saving ? 'Saving…' : paymentMode === 'existing' ? 'Link existing payment' : 'Record payment'}</Button></form></DialogContent></Dialog>
  </Card>;
}
