// Scheduled (via pg_cron) — checks every active workspace's last_active_at
// and sends the 3 staged inactivity warnings, then pauses (soft-deletes) a
// workspace at 30 days of inactivity. Separately marks any workspace past
// its 7-day recovery grace period as "purged" — see the migration this
// pairs with (20260901030000_workspace_lifecycle.sql) for why that's a flag
// and not an actual data-destroying delete.
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('LIFECYCLE_FROM_EMAIL') ?? 'onboarding@resend.dev';
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:8080';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — skipping email send');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error('Resend send failed:', await res.text());
}

async function getSuperadminEmail(workspaceId: string): Promise<string | null> {
  const { data: member } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'superadmin')
    .maybeSingle();
  if (!member) return null;

  const { data } = await supabase.auth.admin.getUserById(member.user_id);
  return data?.user?.email ?? null;
}

// { count of warnings already sent when this one fires, day of inactivity it fires at }
const WARNING_THRESHOLDS = [
  { count: 1, days: 10 },
  { count: 2, days: 17 },
  { count: 3, days: 24 },
];
const DELETE_AFTER_DAYS = 30;
const HARD_DELETE_GRACE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results = { warnings_sent: 0, workspaces_paused: 0, workspaces_purged: 0 };

  // ---- 1. Inactivity warnings, then pause at 30 days -----------------------
  const { data: activeWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name, code, last_active_at, warnings_sent')
    .is('deleted_at', null);

  for (const ws of activeWorkspaces ?? []) {
    const daysInactive = (Date.now() - new Date(ws.last_active_at).getTime()) / MS_PER_DAY;

    if (daysInactive >= DELETE_AFTER_DAYS) {
      await supabase
        .from('workspaces')
        .update({
          deleted_at: new Date().toISOString(),
          hard_delete_at: new Date(Date.now() + HARD_DELETE_GRACE_DAYS * MS_PER_DAY).toISOString(),
        })
        .eq('id', ws.id);

      const email = await getSuperadminEmail(ws.id);
      if (email) {
        await sendEmail(
          email,
          `${ws.name} was paused for inactivity`,
          `<p>Your workspace <strong>${ws.name}</strong> (${ws.code}) hadn't been used in 30 days, so it's been paused.</p>
           <p>Nothing has been deleted. Request it back any time at <a href="${APP_URL}/recover-workspace">${APP_URL}/recover-workspace</a>.</p>`,
        );
      }
      results.workspaces_paused++;
      continue;
    }

    for (const t of WARNING_THRESHOLDS) {
      if (daysInactive >= t.days && ws.warnings_sent < t.count) {
        await supabase
          .from('workspaces')
          .update({ warnings_sent: t.count, last_warning_sent_at: new Date().toISOString() })
          .eq('id', ws.id);

        const email = await getSuperadminEmail(ws.id);
        if (email) {
          const daysLeft = Math.max(1, Math.round(DELETE_AFTER_DAYS - daysInactive));
          await sendEmail(
            email,
            `Warning ${t.count}/3: ${ws.name} has been inactive`,
            `<p>Your workspace <strong>${ws.name}</strong> (${ws.code}) hasn't had anyone sign in for a while.</p>
             <p>If nobody signs in within about ${daysLeft} more day(s), it will be automatically paused (not deleted — just paused).</p>
             <p>Just sign in to Kaam to reset the clock.</p>`,
          );
        }
        results.warnings_sent++;
        break;
      }
    }
  }

  // ---- 2. Mark past-grace-period workspaces as purged (non-destructive) ----
  const { data: purgeable } = await supabase
    .from('workspaces')
    .select('id')
    .not('deleted_at', 'is', null)
    .is('purged_at', null)
    .lte('hard_delete_at', new Date().toISOString());

  for (const ws of purgeable ?? []) {
    await supabase.from('workspaces').update({ purged_at: new Date().toISOString() }).eq('id', ws.id);
    results.workspaces_purged++;
  }

  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});
