import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Input } from '@/components/ui/input';
import { UserChip } from '@/components/ui/user-avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace, type WorkspaceRole } from '@/hooks/useWorkspace';
import { toast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { Copy, Loader2, Trash2, Check } from 'lucide-react';

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
};

export const WorkspaceSettingsTab = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { workspace, role, members, membersLoading, refreshMembers, updateMemberRole, removeMember, deleteWorkspace } =
    useWorkspace();
  const [copied, setCopied] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    refreshMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const isAdminOrAbove = role === 'superadmin' || role === 'admin';
  const isSuperadmin = role === 'superadmin';

  const handleCopyCode = async () => {
    if (!workspace) return;
    await navigator.clipboard.writeText(workspace.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    const { error } = await updateMemberRole(memberId, newRole);
    if (error) {
      toast({ title: 'Could not update role', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Role updated' });
    }
  };

  const handleRemove = async (memberId: string, name: string) => {
    const { error } = await removeMember(memberId);
    if (error) {
      toast({ title: 'Could not remove member', description: error, variant: 'destructive' });
    } else {
      toast({ title: `${name} removed from the workspace` });
    }
  };

  const handleDelete = async () => {
    if (!user?.email) return;
    if (deleteConfirmText !== 'DELETE MY WORKSPACE') {
      toast({ title: 'Type the confirmation exactly as shown', variant: 'destructive' });
      return;
    }
    setDeleting(true);

    // Re-verify the current password against Supabase Auth itself before
    // doing anything destructive — this doesn't touch the workspace, it's
    // purely an identity check.
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: deletePassword,
    });
    if (authError) {
      toast({ title: 'Incorrect password', description: 'Workspace was not deleted.', variant: 'destructive' });
      setDeleting(false);
      return;
    }

    const { error } = await deleteWorkspace();
    if (error) {
      toast({ title: 'Could not delete workspace', description: error, variant: 'destructive' });
      setDeleting(false);
      return;
    }

    toast({ title: 'Workspace deleted', description: 'It can be recovered within 7 days if needed.' });
    await signOut();
    navigate('/', { replace: true });
  };

  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your workspace</CardTitle>
          <CardDescription>Every member sees this workspace code — share it to invite people</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <p className="text-lg font-semibold">{workspace.name}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Workspace code</Label>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border bg-muted/50 px-3 py-1.5 font-mono text-lg font-bold tracking-[0.2em]">
                  {workspace.code}
                </span>
                <Button variant="outline" size="icon" onClick={handleCopyCode} title="Copy code">
                  {copied ? <Check className="h-4 w-4 text-chart-6" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Your role:</span>
            <Badge variant="outline">{ROLE_LABELS[role ?? 'employee']}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>
            {isAdminOrAbove ? 'Manage roles and access for your team' : 'Everyone currently in this workspace'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {members.map((m) => {
                const isSelf = m.user_id === user?.id;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40">
                    <UserChip name={m.full_name} email={m.email} avatarUrl={m.avatar_url} subtitle={m.email} />
                    <div className="flex shrink-0 items-center gap-2">
                      {isAdminOrAbove && !isSelf && m.role !== 'superadmin' ? (
                        <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v as WorkspaceRole)}>
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{ROLE_LABELS[m.role]}</Badge>
                      )}
                      {isAdminOrAbove && !isSelf && m.role !== 'superadmin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(m.id, m.full_name || m.email)}
                          title="Remove from workspace"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isSuperadmin && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting your workspace signs everyone out. It can be recovered within 7 days before it's gone for good.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) {
                  setDeletePassword('');
                  setDeleteConfirmText('');
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {workspace.name}?</DialogTitle>
                  <DialogDescription>
                    This signs out every member immediately. The workspace can be recovered within 7 days — after
                    that, it and everything in it is gone permanently.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="delete-password">Confirm your password</Label>
                    <PasswordInput
                      id="delete-password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm">
                      Type <span className="font-mono font-bold">DELETE MY WORKSPACE</span> to confirm
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting || !deletePassword || deleteConfirmText !== 'DELETE MY WORKSPACE'}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete workspace'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
