import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PresenceAvatar } from '@/components/ui/presence-avatar';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Member {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  availability_status: string | null;
  team_department: string | null;
  tasks: number;
  isLead: boolean;
}

const statusTone = (status?: string | null) => {
  switch ((status || '').toLowerCase()) {
    case 'available':
      return 'bg-chart-4/15 text-chart-4 border-chart-4/30';
    case 'busy':
      return 'bg-brand-orange/15 text-brand-orange border-brand-orange/30';
    case 'away':
    case 'on_leave':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-primary/10 text-primary border-primary/20';
  }
};

const ProjectMembers = ({ projectId, leadId }: { projectId: string; leadId?: string }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: issues }, { data: invites }, { data: project }] = await Promise.all([
      supabase.from('issues').select('id, reporter_id, assignee_id').eq('project_id', projectId),
      supabase.from('project_invitations').select('email, status').eq('project_id', projectId).eq('status', 'accepted'),
      supabase.from('projects').select('lead_id, created_by').eq('id', projectId).single(),
    ]);

    const issueIds = (issues || []).map((i) => i.id);
    const { data: multi } = issueIds.length
      ? await supabase.from('issue_assignees').select('user_id, issue_id').in('issue_id', issueIds)
      : { data: [] as { user_id: string; issue_id: string }[] };

    const taskCount = new Map<string, Set<string>>();
    const add = (uid?: string | null, issueId?: string) => {
      if (!uid) return;
      if (!taskCount.has(uid)) taskCount.set(uid, new Set());
      if (issueId) taskCount.get(uid)!.add(issueId);
    };

    (issues || []).forEach((i) => {
      add(i.reporter_id, i.id);
      add(i.assignee_id, i.id);
    });
    (multi || []).forEach((m) => add(m.user_id, m.issue_id));
    add(project?.lead_id ?? leadId);
    add(project?.created_by);

    const ids = Array.from(taskCount.keys());
    const emails = (invites || []).map((i) => i.email);

    const [{ data: byId }, { data: byEmail }] = await Promise.all([
      ids.length
        ? supabase
            .from('profiles')
            .select('user_id, full_name, email, avatar_url, role, availability_status, team_department')
            .in('user_id', ids)
        : Promise.resolve({ data: [] as any[] }),
      emails.length
        ? supabase
            .from('profiles')
            .select('user_id, full_name, email, avatar_url, role, availability_status, team_department')
            .in('email', emails)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const map = new Map<string, Member>();
    [...(byId || []), ...(byEmail || [])].forEach((p: any) => {
      if (map.has(p.user_id)) return;
      map.set(p.user_id, {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
        role: p.role,
        availability_status: p.availability_status,
        team_department: p.team_department,
        tasks: taskCount.get(p.user_id)?.size || 0,
        isLead: p.user_id === (project?.lead_id ?? leadId),
      });
    });

    setMembers(
      Array.from(map.values()).sort((a, b) => Number(b.isLead) - Number(a.isLead) || b.tasks - a.tasks),
    );
    setLoading(false);
  }, [projectId, leadId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span>Team Members</span>
          <Badge variant="secondary">{members.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No members yet — invite someone or assign a task to add people to this project.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 rounded-lg border p-3">
                <PresenceAvatar userId={m.user_id} size="md" name={m.full_name} email={m.email} avatarUrl={m.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{m.full_name || m.email}</p>
                    {m.isLead && <Badge className="bg-gradient-brand text-primary-foreground">Lead</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {m.role && <Badge variant="outline" className="text-[0.7rem] capitalize">{m.role}</Badge>}
                    {m.team_department && (
                      <Badge variant="secondary" className="text-[0.7rem]">{m.team_department}</Badge>
                    )}
                    {m.availability_status && (
                      <Badge variant="outline" className={cn('text-[0.7rem] capitalize', statusTone(m.availability_status))}>
                        {m.availability_status.replace('_', ' ')}
                      </Badge>
                    )}
                    <span className="text-[0.7rem] font-semibold text-muted-foreground">
                      {m.tasks} task{m.tasks === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectMembers;
