import type { SupabaseClient } from '@supabase/supabase-js';

export const money = (value: number, currency = 'NPR') =>
  new Intl.NumberFormat('en-NP', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

// Management categories tailored to software, service, and marketing agencies.
export const EXPENSE_CATEGORIES = [
  'Bank & payment processing fees',
  'Cloud hosting & infrastructure',
  'Contractors & freelancers',
  'Creative production',
  'Domains & web services',
  'Employee benefits',
  'Employee salaries & wages',
  'Equipment & devices',
  'Food, cafe & team meals',
  'Insurance',
  'Office rent & coworking',
  'Paid media & ad spend',
  'Professional & legal fees',
  'Project-based team payments',
  'Sales commissions',
  'Software & SaaS',
  'Taxes & licenses',
  'Training & certifications',
  'Travel & transport',
  'Utilities & internet',
] as const;

export const INCOME_CATEGORIES = [
  'App development',
  'Branding & creative design',
  'Consulting & strategy',
  'Hosting & managed services',
  'Investment & funding',
  'Maintenance & support',
  'Paid media management',
  'SEO services',
  'Social media management',
  'Software development',
  'Website development',
] as const;

export const categoriesFor = (type: string): readonly string[] =>
  type === 'income' || type === 'receivable' ? INCOME_CATEGORIES
  : type === 'expense' || type === 'payable' ? EXPENSE_CATEGORIES
  : ['Inter-project transfer'];

// Supabase responses are capped by the project's configured row limit, often
// 1,000. Fetch every page before calculating a financial total.
export async function fetchAllLedgerRows<T>(
  client: SupabaseClient,
  table: 'account_transactions' | 'account_obligations',
  columns: string,
  ledgerIds: string[],
): Promise<T[]> {
  const rows: T[] = [];
  if (!ledgerIds.length) return rows;
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await client.from(table).select(columns).in('ledger_id', ledgerIds)
      .order('id').range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < pageSize) return rows;
  }
}
