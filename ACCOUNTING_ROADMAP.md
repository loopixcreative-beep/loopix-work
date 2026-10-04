# Project accounts roadmap

## Implemented in this change

1. Keep the existing Supabase browser session. Token renewal no longer resets the workspace route or replaces the page with a full-screen loading state. Account data refreshes quietly when a tab becomes visible and every minute while visible.
2. Add one cash ledger per project and one workspace-wide setting row. Existing projects and workspaces are seeded by the migration; new projects receive a ledger automatically. Admins choose exactly one main project in Project Settings → Account. The main project's Account tab reads and totals all source project ledgers without copying rows.
3. Record dated transactions with an automatically generated project-prefixed ID, income/expense/transfer type, category, positive amount, and remarks. Show a running cash balance and source project. Transfers move cash but do not count as earnings or spending. Bank reference and counterparty inputs were removed.
4. Let workspace admins and managers add and edit transactions or upload/replace monthly PDF/image bank statements. Related project members can view their project's ledger and signed, short-lived statement links. Database and Storage policies enforce access.
5. Give admins and managers a main-project dashboard with income and expense totals, project comparisons, spending categories, monthly activity, and outstanding receivables/payables.
6. Track receivables and payables separately from cash. A linked full or partial payment creates one cash transaction and reduces the outstanding amount. The database prevents overpayment.
7. Keep database audit records for every transaction and obligation insert or update. Neither has a delete action.
8. Preserve any entries or statements previously saved in the old business ledger under a clearly labeled historical source in the main account. New entries belong to a project ledger.
9. Offer optional project-based budgets at the top of each project's Account tab. Admins and managers allocate a budget to a workspace member, then record linked project payments. The section shows paid to date, remaining budget, percent paid, and payment IDs. A database trigger prevents paying above the allocation or reducing a budget below payments. Each payment is one ordinary project expense and appears in the main account rollup automatically.
10. Paginate project and main-project transaction and obligation tables ten rows at a time; filter obligations by receivable or payable without changing account totals. Show income in green on the workspace account charts, and keep the project Account tab text-only like the other project tabs.
11. Allow long category lists to scroll within the available screen height, including the income list in the transaction dialog.
12. Save a per-project budget-section visibility setting. Managers can show or hide the entire allocation section without deleting budgets or payments; employees can read their own allocation only while the section is visible. New projects start hidden and projects with existing allocations stay visible after migration.
13. Let managers link an unlinked, existing expense to an employee allocation. The original transaction ID, date, category, amount, and single cash entry remain intact; the link updates budget paid/remaining totals and marks the row as a project payment in the main account transaction view.
14. Include eligible expenses from every ledger in the same workspace and currency when linking an existing payment. A centrally paid salary can therefore settle a different project's employee budget while staying in its original source account. The database limits linked payments to the workspace and currency and permits the allocated employee to read their own linked payment when the section is visible.

## Agency category research

The dropdowns contain 20 expense and 10 income categories tailored to software, service, and marketing agencies. Expense choices explicitly include employee salaries and wages, plus food, cafe work sessions, and team meals. General expense groupings come from the [IRS Schedule C instructions](https://www.irs.gov/instructions/i1040sc), including wages, contract labor, advertising, rent, software, and professional services. The income labels are inferred from the [U.S. Census service classifications](https://www.census.gov/naics/resources/archives/sect54.html) for programming, design, advertising, and marketing consulting, with agency-specific subcategories for development and managed services. These are internal management categories, not a prescribed tax chart of accounts. Open receivables and payables stay outside cash totals until paid, consistent with the cash-receipt and cash-payment distinction in [IAS 7](https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows/).

## Deployment and verification

Apply all five accounting migrations, in filename order, to the Supabase project linked by `supabase/config.toml`. This session's connected Supabase accounts and CLI returned permission denied, so they were not applied remotely. After applying them, sign in as an admin/manager and a related employee to verify:

- manager can create and edit a transaction; employee can read but cannot write through either UI or Data API;
- an unrelated employee cannot read the ledger or a bank statement;
- a monthly statement uploads, opens via signed URL, and can be replaced;
- a new project receives a ledger automatically;
- an admin can select a main project from any project's Settings → Account tab; a manager cannot change it;
- a transaction entered once in a child project appears in the main project with its source and an automatic ID;
- a receivable/payable does not change cash until a linked payment is recorded; partial payments reduce the outstanding amount;
- returning to the tab updates values without replacing the entire page.
- the income category list scrolls to the last item in the transaction dialog;
- a project with no employee allocation still works normally; a manager can set an allocation and record a partial payment;
- that payment appears once in the project and main account, reduces the remaining budget, and cannot exceed it;
- an employee can see their own allocation but cannot edit it or inspect another employee's allocation.
- hiding a project's budget section removes it for members while preserving manager access and all saved amounts;
- linking an existing salary expense raises the employee's paid total without creating another transaction or changing the main account cash balance.
- a centrally paid expense from another project appears in the existing-transaction dropdown with its source project; expenses in another currency do not.

## Accounting scope

This is a management cash ledger, not a statutory general ledger or bank integration. Reconciliation, approvals, tax treatment, multi-currency conversion, and formal financial statements need separate controls and accountant review before those figures are used for filing or external reporting.
