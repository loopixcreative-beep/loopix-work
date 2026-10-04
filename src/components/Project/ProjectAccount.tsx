import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { categoriesFor, fetchAllLedgerRows, money } from '@/lib/accounting';
import { FileText, Plus, RefreshCw, Upload, Pencil, ArrowUpRight } from 'lucide-react';
import ProjectTeamBudget from '@/components/Project/ProjectTeamBudget';

type Ledger = { id: string; workspace_id: string; project_id: string | null; currency: string; opening_balance: number; main_project_id: string | null };
type TxType = 'income' | 'expense' | 'transfer_in' | 'transfer_out';
type Entry = { id: string; ledger_id: string; transaction_id: string; transaction_date: string; type: TxType; category: string; amount: number; remarks: string; obligation_id: string | null; employee_budget_id: string | null; created_at: string };
type Obligation = { id: string; ledger_id: string; obligation_id: string; kind: 'receivable' | 'payable'; issue_date: string; due_date: string; category: string; amount: number; remarks: string };
type Statement = { id: string; ledger_id: string; statement_month: string; file_name: string; storage_path: string };
type TxForm = { transaction_date: string; type: TxType; category: string; amount: string; remarks: string; obligation_id: string | null };
type ObligationForm = { kind: 'receivable' | 'payable'; issue_date: string; due_date: string; category: string; amount: string; remarks: string };
const db = supabase as unknown as SupabaseClient;
const today = () => new Date().toISOString().slice(0, 10);
const blankTx = (): TxForm => ({ transaction_date: today(), type: 'expense', category: '', amount: '', remarks: '', obligation_id: null });
const blankObligation = (): ObligationForm => ({ kind: 'receivable', issue_date: today(), due_date: today(), category: '', amount: '', remarks: '' });
const direction = (type: TxType) => type === 'income' || type === 'transfer_in' ? 1 : -1;
const options = (type: string, current: string) =>
  [...new Set([...categoriesFor(type), ...(current ? [current] : [])])].sort((a, b) => a.localeCompare(b));
const PAGE_SIZE = 10;

function PageControls({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const pages = Math.ceil(total / PAGE_SIZE);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 text-sm text-muted-foreground">
    <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
      <span aria-live="polite">Page {page} of {pages}</span>
      <Button size="sm" variant="outline" disabled={page === pages} onClick={() => onPageChange(page + 1)}>Next</Button>
    </div>
  </div>;
}

export default function ProjectAccount({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { workspace, role } = useWorkspace();
  const workspaceId = workspace?.id;
  const { toast } = useToast();
  const canEdit = role === 'superadmin' || role === 'admin' || role === 'manager';
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [sourceLedgers, setSourceLedgers] = useState<Ledger[]>([]);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [isMain, setIsMain] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [obligationOpen, setObligationOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<string | null>(null);
  const [editingObligation, setEditingObligation] = useState<string | null>(null);
  const [txForm, setTxForm] = useState<TxForm>(blankTx);
  const [obligationForm, setObligationForm] = useState<ObligationForm>(blankObligation);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [transactionPage, setTransactionPage] = useState(1);
  const [obligationPage, setObligationPage] = useState(1);
  const [obligationFilter, setObligationFilter] = useState<'all' | 'receivable' | 'payable'>('all');

  const load = useCallback(async (quiet = false) => {
    if (!workspaceId || !projectId) return;
    if (!quiet) setLoading(true);
    try {
      const [projectAccount, workspaceSetting] = await Promise.all([
        db.from('account_ledgers').select('*').eq('project_id', projectId).eq('workspace_id', workspaceId).maybeSingle(),
        db.from('account_ledgers').select('main_project_id').eq('workspace_id', workspaceId).is('project_id', null).maybeSingle(),
      ]);
      if (projectAccount.error) throw projectAccount.error;
      if (workspaceSetting.error) throw workspaceSetting.error;
      let own: Ledger | null = projectAccount.data;
      if (!own && canEdit) {
        const created = await db.from('account_ledgers').insert({ workspace_id: workspaceId, project_id: projectId, name: 'Project account' }).select().single();
        if (created.error?.code === '23505') own = (await db.from('account_ledgers').select('*').eq('project_id', projectId).maybeSingle()).data;
        else if (created.error) throw created.error;
        else own = created.data;
      }
      setLedger(own);
      if (!own) { setEntries([]); setObligations([]); setStatements([]); return; }
      const main = canEdit && workspaceSetting.data?.main_project_id === projectId;
      setIsMain(main);
      let ledgers: Ledger[] = [own];
      if (main) {
        const all = await db.from('account_ledgers').select('id,workspace_id,project_id,currency,opening_balance,main_project_id')
          .eq('workspace_id', workspaceId);
        if (all.error) throw all.error;
        ledgers = all.data ?? [own];
      }
      setSourceLedgers(ledgers);
      const projectIds = ledgers.map(item => item.project_id).filter((id): id is string => !!id);
      const names = projectIds.length
        ? await supabase.from('projects').select('id,name').in('id', projectIds)
        : { data: [] as { id: string; name: string }[], error: null };
      if (names.error) throw names.error;
      const projectNames = new Map((names.data ?? []).map(item => [item.id, item.name]));
      setSourceNames(Object.fromEntries(ledgers.map(item => [item.id, item.project_id ? (projectNames.get(item.project_id) ?? 'Project') : 'Historical business account'])));
      const ids = ledgers.map(item => item.id);
      const [tx, due, docs] = await Promise.all([
        fetchAllLedgerRows<Entry>(db, 'account_transactions', 'id,ledger_id,transaction_id,transaction_date,type,category,amount,remarks,obligation_id,employee_budget_id,created_at', ids),
        fetchAllLedgerRows<Obligation>(db, 'account_obligations', 'id,ledger_id,obligation_id,kind,issue_date,due_date,category,amount,remarks', ids),
        db.from('account_statements').select('id,ledger_id,statement_month,file_name,storage_path').in('ledger_id', ids).order('statement_month', { ascending: false }),
      ]);
      if (docs.error) throw docs.error;
      setEntries(tx.sort((a,b) => a.transaction_date.localeCompare(b.transaction_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
      setObligations(due.sort((a,b) => a.due_date.localeCompare(b.due_date)));
      setStatements(docs.data ?? []);
    } catch (error) {
      if (!quiet) { setLedger(null); setEntries([]); setObligations([]); setStatements([]); }
      toast({ title: 'Account unavailable', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally { setLoading(false); }
  }, [workspaceId, projectId, canEdit, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 60000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [load]);

  const rows = useMemo(() => {
    let balance = sourceLedgers.reduce((sum, item) => sum + Number(item.opening_balance), 0);
    return entries.map(entry => {
      balance += direction(entry.type) * Number(entry.amount);
      return { ...entry, balance };
    }).reverse();
  }, [entries, sourceLedgers]);
  const balance = rows[0]?.balance ?? sourceLedgers.reduce((sum, item) => sum + Number(item.opening_balance), 0);
  const income = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + Number(e.amount), 0);
  const expense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0);
  const paidByObligation = useMemo(() => {
    const paid = new Map<string, number>();
    entries.forEach(entry => { if (entry.obligation_id) paid.set(entry.obligation_id, (paid.get(entry.obligation_id) ?? 0) + Number(entry.amount)); });
    return paid;
  }, [entries]);
  const outstanding = (item: Obligation) => Math.max(0, Number(item.amount) - (paidByObligation.get(item.id) ?? 0));
  const receivable = obligations.filter(item => item.kind === 'receivable').reduce((sum, item) => sum + outstanding(item), 0);
  const payable = obligations.filter(item => item.kind === 'payable').reduce((sum, item) => sum + outstanding(item), 0);
  const filteredObligations = obligations.filter(item => obligationFilter === 'all' || item.kind === obligationFilter);
  const visibleTransactionPage = Math.min(transactionPage, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
  const visibleObligationPage = Math.min(obligationPage, Math.max(1, Math.ceil(filteredObligations.length / PAGE_SIZE)));
  const visibleRows = rows.slice((visibleTransactionPage - 1) * PAGE_SIZE, visibleTransactionPage * PAGE_SIZE);
  const visibleObligations = filteredObligations.slice((visibleObligationPage - 1) * PAGE_SIZE, visibleObligationPage * PAGE_SIZE);

  const saveTransaction = async (event: FormEvent) => {
    event.preventDefault();
    if (!ledger || !canEdit) return;
    const amount = Number(txForm.amount);
    if (!txForm.category || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Choose a category and enter a positive amount', variant: 'destructive' }); return;
    }
    setUpdating(true);
    const values = { ledger_id: ledger.id, transaction_date: txForm.transaction_date, type: txForm.type,
      category: txForm.category, amount, remarks: txForm.remarks.trim(), obligation_id: txForm.obligation_id };
    const result = editingTx
      ? await db.from('account_transactions').update(values).eq('id', editingTx).eq('ledger_id', ledger.id)
      : await db.from('account_transactions').insert({ ...values, created_by: user?.id });
    setUpdating(false);
    if (result.error) toast({ title: 'Could not save transaction', description: friendlyErrorMessage(result.error), variant: 'destructive' });
    else { setTxOpen(false); setEditingTx(null); setTxForm(blankTx()); await load(true); }
  };
  const saveObligation = async (event: FormEvent) => {
    event.preventDefault();
    if (!ledger || !canEdit) return;
    const amount = Number(obligationForm.amount);
    if (!obligationForm.category || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Choose a category and enter a positive amount', variant: 'destructive' }); return;
    }
    setUpdating(true);
    const values = { ledger_id: ledger.id, kind: obligationForm.kind, issue_date: obligationForm.issue_date,
      due_date: obligationForm.due_date, category: obligationForm.category, amount, remarks: obligationForm.remarks.trim() };
    const result = editingObligation
      ? await db.from('account_obligations').update(values).eq('id', editingObligation).eq('ledger_id', ledger.id)
      : await db.from('account_obligations').insert({ ...values, created_by: user?.id });
    setUpdating(false);
    if (result.error) toast({ title: 'Could not save obligation', description: friendlyErrorMessage(result.error), variant: 'destructive' });
    else { setObligationOpen(false); setEditingObligation(null); setObligationForm(blankObligation()); await load(true); }
  };
  const startPayment = (item: Obligation) => {
    if (!ledger || item.ledger_id !== ledger.id) return;
    setEditingTx(null);
    setTxForm({ transaction_date: today(), type: item.kind === 'receivable' ? 'income' : 'expense',
      category: item.category, amount: String(outstanding(item)), remarks: `Payment for ${item.obligation_id}`, obligation_id: item.id });
    setTxOpen(true);
  };
  const upload = async () => {
    if (!ledger || !file || !canEdit) return;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast({ title: 'Use a PDF, PNG, or JPEG under 10 MB', variant: 'destructive' }); return;
    }
    const existing = statements.find(item => item.ledger_id === ledger.id && item.statement_month === month + '-01');
    setUpdating(true);
    const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${ledger.id}/${month}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage.from('account-statements').upload(path, file, { contentType: file.type });
    if (uploaded.error) {
      setUpdating(false); toast({ title: 'Upload failed', description: friendlyErrorMessage(uploaded.error), variant: 'destructive' }); return;
    }
    const values = { ledger_id: ledger.id, statement_month: month + '-01', file_name: file.name, storage_path: path, uploaded_by: user?.id };
    const result = existing
      ? await db.from('account_statements').update(values).eq('id', existing.id).eq('ledger_id', ledger.id)
      : await db.from('account_statements').insert(values);
    setUpdating(false);
    if (result.error) {
      await supabase.storage.from('account-statements').remove([path]);
      toast({ title: 'Statement record failed', description: friendlyErrorMessage(result.error), variant: 'destructive' });
    } else {
      if (existing) await supabase.storage.from('account-statements').remove([existing.storage_path]);
      setFile(null); await load(true); toast({ title: existing ? 'Statement replaced' : 'Statement uploaded' });
    }
  };
  const openStatement = async (path: string) => {
    const { data, error } = await supabase.storage.from('account-statements').createSignedUrl(path, 60);
    if (error || !data?.signedUrl) toast({ title: 'Could not open statement', description: friendlyErrorMessage(error), variant: 'destructive' });
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <Card><CardContent className="p-6 text-muted-foreground">Loading account…</CardContent></Card>;
  if (!ledger) return <Card><CardContent className="p-6 text-muted-foreground">No account is available for this project yet.</CardContent></Card>;
  const currency = ledger.currency;
  return <div className="space-y-5">
    {isMain && <div className="rounded-lg border border-primary/25 bg-primary/5 p-4"><p className="font-semibold">Main project account</p><p className="text-sm text-muted-foreground">Entries from every project appear here automatically. Each entry is stored only in its source project.</p><Button asChild variant="link" className="h-auto px-0"><Link to="/app/accounts">Open account dashboard <ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[
        ['Cash balance', balance, ''],
        ['Income received', income, 'text-emerald-600'],
        ['Expenses paid', expense, 'text-orange-600'],
        ['Accounts receivable', receivable, 'text-blue-600'],
        ['Accounts payable', payable, 'text-amber-600'],
      ].map(([label, value, tone]) => <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className={`text-xl font-bold ${tone}`}>{money(Number(value), currency)}</CardContent></Card>)}
    </div>

    <ProjectTeamBudget projectId={projectId} onPaymentRecorded={() => load(true)} />

    <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><div><CardTitle>Transactions</CardTitle><p className="mt-1 text-sm text-muted-foreground">IDs are generated from the source project. Unpaid obligations do not change cash balance.</p></div><div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => load(true)} aria-label="Refresh account"><RefreshCw className="h-4 w-4" /></Button>
      {canEdit && <Dialog open={txOpen} onOpenChange={setTxOpen}><DialogTrigger asChild><Button size="sm" onClick={() => { setEditingTx(null); setTxForm(blankTx()); }}><Plus className="mr-2 h-4 w-4" />Transaction</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingTx ? 'Edit transaction' : 'Add transaction'}</DialogTitle></DialogHeader>
          <form onSubmit={saveTransaction} className="grid gap-3">
            <p className="text-sm text-muted-foreground">Transaction ID is generated automatically after saving. This entry belongs to {sourceNames[ledger.id]}.</p>
            {txForm.obligation_id && <p className="rounded-md bg-primary/10 p-2 text-sm">This payment is linked to an outstanding obligation.</p>}
            {editingTx && entries.some(entry => entry.id === editingTx && entry.employee_budget_id) && <p className="rounded-md bg-primary/10 p-2 text-sm">This expense is linked to an employee project budget.</p>}
            <div className="grid grid-cols-2 gap-3"><div><Label>Date</Label><Input required type="date" value={txForm.transaction_date} onChange={e => setTxForm({ ...txForm, transaction_date: e.target.value })} /></div>
              <div><Label>Type</Label><Select value={txForm.type} disabled={!!txForm.obligation_id || !!(editingTx && entries.some(entry => entry.id === editingTx && entry.employee_budget_id))} onValueChange={(value: TxType) => setTxForm({ ...txForm, type: value, category: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['income','expense','transfer_in','transfer_out'] as const).map(type => <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Category</Label><Select value={txForm.category} onValueChange={value => setTxForm({ ...txForm, category: value })}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{options(txForm.type, txForm.category).map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Amount ({currency})</Label><Input required type="number" step="0.01" min="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} /></div></div>
            <div><Label>Remarks</Label><Textarea value={txForm.remarks} onChange={e => setTxForm({ ...txForm, remarks: e.target.value })} /></div>
            <Button disabled={updating} type="submit">{updating ? 'Saving…' : 'Save transaction'}</Button>
          </form>
        </DialogContent></Dialog>}</div></CardHeader>
      <CardContent><div className="overflow-x-auto"><table className="w-full min-w-[790px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr>{['Date','Transaction ID',...(isMain ? ['Source project'] : []),'Type','Category','Remarks','Amount','Balance',''].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>
        {visibleRows.map(row => <tr key={row.id} className="border-b last:border-0"><td className="px-3 py-3">{row.transaction_date}</td><td className="px-3 py-3 font-medium">{row.transaction_id}</td>
          {isMain && <td className="px-3 py-3">{sourceLedgers.find(item => item.id === row.ledger_id)?.project_id ? <Link to={`/app/projects/${sourceLedgers.find(item => item.id === row.ledger_id)?.project_id}/account`} className="text-primary hover:underline">{sourceNames[row.ledger_id]}</Link> : sourceNames[row.ledger_id]}</td>}
          <td className="px-3 py-3"><Badge variant="secondary">{row.type.replace('_',' ')}</Badge></td><td className="px-3 py-3">{row.category}{row.employee_budget_id && <Badge variant="outline" className="ml-2">Project payment</Badge>}</td><td className="px-3 py-3">{row.remarks}</td>
          <td className={`px-3 py-3 font-semibold ${direction(row.type) > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>{direction(row.type) > 0 ? '+' : '−'}{money(Number(row.amount), currency)}</td>
          <td className="px-3 py-3 font-medium">{money(row.balance, currency)}</td><td className="px-3 py-3">{canEdit && row.ledger_id === ledger.id && <Button variant="ghost" size="icon" aria-label={`Edit ${row.transaction_id}`} onClick={() => { setEditingTx(row.id); setTxForm({ transaction_date: row.transaction_date, type: row.type, category: row.category, amount: String(row.amount), remarks: row.remarks, obligation_id: row.obligation_id }); setTxOpen(true); }}><Pencil className="h-4 w-4" /></Button>}</td></tr>)}
        {!rows.length && <tr><td colSpan={isMain ? 9 : 8} className="px-3 py-10 text-center text-muted-foreground">No transactions recorded yet.</td></tr>}
      </tbody></table></div><PageControls page={visibleTransactionPage} total={rows.length} onPageChange={setTransactionPage} /></CardContent>
    </Card>

    <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><div><CardTitle>Receivables & payables</CardTitle><p className="mt-1 text-sm text-muted-foreground">Track money owed before it is received or paid.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Select value={obligationFilter} onValueChange={(value: 'all' | 'receivable' | 'payable') => { setObligationFilter(value); setObligationPage(1); }}><SelectTrigger className="w-[170px]" aria-label="Filter receivables and payables"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="receivable">Receivables</SelectItem><SelectItem value="payable">Payables</SelectItem></SelectContent></Select>
      {canEdit && <Dialog open={obligationOpen} onOpenChange={setObligationOpen}><DialogTrigger asChild><Button size="sm" onClick={() => { setEditingObligation(null); setObligationForm(blankObligation()); }}><Plus className="mr-2 h-4 w-4" />Add item</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>{editingObligation ? 'Edit amount due' : 'Add receivable or payable'}</DialogTitle></DialogHeader>
          <form onSubmit={saveObligation} className="grid gap-3"><div><Label>Type</Label><Select value={obligationForm.kind} disabled={!!editingObligation} onValueChange={(value: 'receivable' | 'payable') => setObligationForm({ ...obligationForm, kind: value, category: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="receivable">Account receivable — money to receive</SelectItem><SelectItem value="payable">Account payable — money to pay</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Recorded date</Label><Input required type="date" value={obligationForm.issue_date} onChange={e => setObligationForm({ ...obligationForm, issue_date: e.target.value })} /></div><div><Label>Due date</Label><Input required type="date" value={obligationForm.due_date} onChange={e => setObligationForm({ ...obligationForm, due_date: e.target.value })} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Category</Label><Select value={obligationForm.category} onValueChange={value => setObligationForm({ ...obligationForm, category: value })}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{options(obligationForm.kind, obligationForm.category).map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div><Label>Amount ({currency})</Label><Input required type="number" step="0.01" min="0.01" value={obligationForm.amount} onChange={e => setObligationForm({ ...obligationForm, amount: e.target.value })} /></div></div>
            <div><Label>Remarks</Label><Textarea value={obligationForm.remarks} onChange={e => setObligationForm({ ...obligationForm, remarks: e.target.value })} /></div><Button disabled={updating} type="submit">{updating ? 'Saving…' : 'Save item'}</Button>
          </form>
        </DialogContent></Dialog>}</div></CardHeader>
      <CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr>{['Due','ID',...(isMain ? ['Source project'] : []),'Type','Category','Total','Outstanding','Status',''].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>
        {visibleObligations.map(item => { const due = outstanding(item); const own = item.ledger_id === ledger.id; const status = due === 0 ? 'Paid' : due < Number(item.amount) ? 'Partial' : item.due_date < today() ? 'Overdue' : 'Open'; return <tr key={item.id} className="border-b last:border-0"><td className="px-3 py-3">{item.due_date}</td><td className="px-3 py-3 font-medium">{item.obligation_id}</td>{isMain && <td className="px-3 py-3">{sourceNames[item.ledger_id]}</td>}<td className="px-3 py-3 capitalize">{item.kind}</td><td className="px-3 py-3">{item.category}<span className="block text-xs text-muted-foreground">{item.remarks}</span></td><td className="px-3 py-3">{money(Number(item.amount), currency)}</td><td className="px-3 py-3 font-semibold">{money(due, currency)}</td><td className="px-3 py-3"><Badge variant={status === 'Overdue' ? 'destructive' : 'secondary'}>{status}</Badge></td><td className="px-3 py-3"><div className="flex gap-1">{canEdit && own && due > 0 && <Button size="sm" variant="outline" onClick={() => startPayment(item)}>Record payment</Button>}{canEdit && own && <Button size="icon" variant="ghost" aria-label={`Edit ${item.obligation_id}`} onClick={() => { setEditingObligation(item.id); setObligationForm({ kind: item.kind, issue_date: item.issue_date, due_date: item.due_date, category: item.category, amount: String(item.amount), remarks: item.remarks }); setObligationOpen(true); }}><Pencil className="h-4 w-4" /></Button>}</div></td></tr>; })}
        {!filteredObligations.length && <tr><td colSpan={isMain ? 9 : 8} className="px-3 py-10 text-center text-muted-foreground">No {obligationFilter === 'all' ? 'receivables or payables' : obligationFilter === 'receivable' ? 'receivables' : 'payables'} recorded yet.</td></tr>}
      </tbody></table></div><PageControls page={visibleObligationPage} total={filteredObligations.length} onPageChange={setObligationPage} /></CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Monthly bank statements</CardTitle><p className="text-sm text-muted-foreground">These files belong to this project. Related members can view them.</p></CardHeader><CardContent className="space-y-4">
      {canEdit && <div className="flex flex-wrap items-end gap-3"><div><Label>Statement month</Label><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div><div><Label>PDF or image · 10 MB max</Label><Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div><Button disabled={!file || !month || updating} onClick={upload}><Upload className="mr-2 h-4 w-4" />Upload</Button></div>}
      <div className="divide-y rounded-md border">{statements.map(doc => <button key={doc.id} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50" onClick={() => openStatement(doc.storage_path)}><FileText className="h-4 w-4 text-primary" /><span className="font-medium">{doc.statement_month.slice(0,7)}</span>{isMain && <span className="text-xs text-muted-foreground">{sourceNames[doc.ledger_id]}</span>}<span className="truncate text-muted-foreground">{doc.file_name}</span></button>)}{!statements.length && <p className="p-4 text-sm text-muted-foreground">No statements uploaded.</p>}</div>
    </CardContent></Card>
  </div>;
}
