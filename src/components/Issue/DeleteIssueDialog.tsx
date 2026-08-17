import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';

export const DELETE_REASONS = [
  'Created by mistake',
  'Requirements changed',
  'Duplicate task',
  'No longer needed',
  'Moved to another project',
  'Other',
];

interface DeleteIssueDialogProps {
  issueId: string;
  issueKey?: string | null;
  issueTitle: string;
  projectId: string;
  onDeleted?: () => void;
  trigger?: React.ReactNode;
}

export const DeleteIssueDialog = ({
  issueId,
  issueKey,
  issueTitle,
  projectId,
  onDeleted,
}: DeleteIssueDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(DELETE_REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const collectProjectMembers = async (): Promise<string[]> => {
    const members = new Set<string>();

    const { data: project } = await supabase
      .from('projects')
      .select('name, lead_id, created_by')
      .eq('id', projectId)
      .maybeSingle();

    if (project?.lead_id) members.add(project.lead_id);
    if (project?.created_by) members.add(project.created_by);

    const { data: issues } = await supabase
      .from('issues')
      .select('id, reporter_id, assignee_id')
      .eq('project_id', projectId);

    const issueIds = (issues || []).map((i) => i.id);
    (issues || []).forEach((i) => {
      if (i.reporter_id) members.add(i.reporter_id);
      if (i.assignee_id) members.add(i.assignee_id);
    });

    if (issueIds.length > 0) {
      const { data: assignees } = await supabase
        .from('issue_assignees')
        .select('user_id')
        .in('issue_id', issueIds);
      (assignees || []).forEach((a) => members.add(a.user_id));
    }

    return Array.from(members);
  };

  const handleDelete = async () => {
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!finalReason) {
      toast({
        title: 'Reason required',
        description: 'Please describe why you are deleting this task.',
        variant: 'destructive',
      });
      return;
    }

    setDeleting(true);
    try {
      const [{ data: project }, members, { data: actor }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
        collectProjectMembers(),
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', user?.id || '')
          .maybeSingle(),
      ]);

      // Remove dependent records first (in case cascades are not configured)
      await supabase.from('issue_assignees').delete().eq('issue_id', issueId);
      await supabase.from('comments').delete().eq('issue_id', issueId);
      await supabase.from('sprint_issues').delete().eq('issue_id', issueId);
      await supabase.from('time_logs').delete().eq('issue_id', issueId);

      const { error } = await supabase.from('issues').delete().eq('id', issueId);
      if (error) throw error;

      const actorName = actor?.full_name || actor?.email || 'A team member';
      const label = issueKey ? `${issueKey} · ${issueTitle}` : issueTitle;

      const recipients = members.filter(Boolean);
      if (recipients.length > 0) {
        await supabase.from('notifications').insert(
          recipients.map((uid) => ({
            user_id: uid,
            type: 'task_deleted',
            title: 'Task deleted',
            message: `${actorName} deleted "${label}"${project?.name ? ` in ${project.name}` : ''}. Reason: ${finalReason}`,
            link: `/projects/${projectId}`,
            metadata: {
              issue_id: issueId,
              issue_key: issueKey,
              project_id: projectId,
              reason: finalReason,
              deleted_by: user?.id,
            },
          }))
        );
      }

      toast({
        title: 'Task deleted',
        description: 'Everyone in the project has been notified.',
      });
      setOpen(false);
      onDeleted?.();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete Task
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              This can't be undone. Everyone in the project will be notified with the reason
              you select.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for deleting</Label>
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                {DELETE_REASONS.map((r) => (
                  <div key={r} className="flex items-center space-x-2">
                    <RadioGroupItem value={r} id={`reason-${r}`} />
                    <Label htmlFor={`reason-${r}`} className="font-medium cursor-pointer">
                      {r}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {reason === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="other-reason">Tell us more</Label>
                <Textarea
                  id="other-reason"
                  rows={3}
                  placeholder="Describe why this task is being deleted"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete & notify team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
