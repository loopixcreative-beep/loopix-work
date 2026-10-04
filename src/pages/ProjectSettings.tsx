import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Trash2, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useToast } from '@/hooks/use-toast';
import { ProjectEdit } from '@/components/Project/ProjectEdit';
import { projectPath } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Project {
  id: string;
  name: string;
  description: string | null;
  objectives: string | null;
  goals: string | null;
  key: string;
  type: string;
}

const ProjectSettings = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { workspace, role } = useWorkspace();
  const canSelectMain = role === 'admin' || role === 'superadmin';
  const canViewMain = canSelectMain || role === 'manager';
  const { toast } = useToast();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainProjectId, setMainProjectId] = useState<string | null>(null);
  const [businessLedgerId, setBusinessLedgerId] = useState<string | null>(null);
  const [accountSetupError, setAccountSetupError] = useState<string | null>(null);
  const [savingMain, setSavingMain] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    slackIntegration: false,
    autoAssign: false,
    requireApproval: true,
    allowGuestComments: false,
    showProgress: true,
    dailyDigest: false,
    weeklyReports: true,
  });

  useEffect(() => {
    if (!workspace?.id || !canViewMain) return;
    const db = supabase as unknown as SupabaseClient;
    db.from('account_ledgers').select('id,main_project_id').eq('workspace_id', workspace.id).is('project_id', null)
      .maybeSingle().then(({ data, error }) => {
        if (error) { setAccountSetupError(error.message); toast({ title: 'Could not load main project', description: error.message, variant: 'destructive' }); }
        else { setAccountSetupError(null); setBusinessLedgerId(data?.id ?? null); setMainProjectId(data?.main_project_id ?? null); }
      });
  }, [workspace?.id, canViewMain, toast]);

  const selectMainProject = async () => {
    if (!project || !workspace || !canSelectMain) return;
    setSavingMain(true);
    const db = supabase as unknown as SupabaseClient;
    let id = businessLedgerId;
    if (!id) {
      const created = await db.from('account_ledgers').insert({ workspace_id: workspace.id, project_id: null, name: 'Business account' }).select('id').single();
      if (created.error?.code === '23505') {
        id = (await db.from('account_ledgers').select('id').eq('workspace_id', workspace.id).is('project_id', null).single()).data?.id ?? null;
      } else if (created.error) {
        setSavingMain(false);
        toast({ title: 'Could not prepare account', description: created.error.message, variant: 'destructive' });
        return;
      } else id = created.data?.id ?? null;
    }
    if (!id) {
      setSavingMain(false);
      toast({ title: 'Could not find account settings', variant: 'destructive' });
      return;
    }
    const next = mainProjectId === project.id ? null : project.id;
    const { error } = await db.from('account_ledgers').update({ main_project_id: next }).eq('id', id);
    setSavingMain(false);
    if (error) toast({ title: 'Could not update main project', description: error.message, variant: 'destructive' });
    else { setBusinessLedgerId(id); setMainProjectId(next); toast({ title: next ? 'Main project selected' : 'Main project cleared' }); }
  };

  const fetchProject = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (projectId) void fetchProject();
  }, [projectId, fetchProject]);

  const handleDeleteProject = async () => {
    if (!project || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: 'Project deleted',
        description: 'The project has been deleted successfully.',
      });
      navigate('/app/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-semibold">Project not found</h2>
        <Button asChild className="mt-4">
          <Link to="/app/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={projectPath(project.id, project.name)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Project
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="account"><Wallet className="mr-2 h-4 w-4" />Account</TabsTrigger>
          {isAdmin && <TabsTrigger value="danger">Danger Zone</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <ProjectEdit project={project} onUpdate={fetchProject} />
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card><CardHeader><CardTitle>Main project account</CardTitle><CardDescription>One project per workspace can be the main account. Its Account tab automatically shows transactions and amounts due from every project, with no re-entry.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {accountSetupError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Account database setup is required: {accountSetupError}</p>}
              <p className="text-sm">{mainProjectId === project.id ? 'This is the main project.' : mainProjectId ? 'Another project is currently the main project.' : 'No main project is selected.'}</p>
              {canSelectMain ? <Button onClick={selectMainProject} disabled={savingMain || !!accountSetupError}>{savingMain ? 'Saving…' : mainProjectId === project.id ? 'Remove main project' : 'Make this the main project'}</Button> : <p className="text-sm text-muted-foreground">Only workspace admins can change this setting.</p>}
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Manage how you receive project updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email updates for project activities</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Digest</Label>
                  <p className="text-sm text-muted-foreground">Get a daily summary of project activities</p>
                </div>
                <Switch
                  checked={settings.dailyDigest}
                  onCheckedChange={(checked) => setSettings({ ...settings, dailyDigest: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly progress reports</p>
                </div>
                <Switch
                  checked={settings.weeklyReports}
                  onCheckedChange={(checked) => setSettings({ ...settings, weeklyReports: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect external tools and services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Slack Integration</Label>
                  <p className="text-sm text-muted-foreground">Send updates to Slack channels</p>
                </div>
                <Switch
                  checked={settings.slackIntegration}
                  onCheckedChange={(checked) => setSettings({ ...settings, slackIntegration: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input placeholder="https://hooks.slack.com/..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation Rules</CardTitle>
              <CardDescription>Set up automated workflows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-assign Issues</Label>
                  <p className="text-sm text-muted-foreground">Automatically assign issues to team members</p>
                </div>
                <Switch
                  checked={settings.autoAssign}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoAssign: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Approval</Label>
                  <p className="text-sm text-muted-foreground">Issues need approval before completion</p>
                </div>
                <Switch
                  checked={settings.requireApproval}
                  onCheckedChange={(checked) => setSettings({ ...settings, requireApproval: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
              <CardDescription>Manage project permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Guest Comments</Label>
                  <p className="text-sm text-muted-foreground">External users can comment on issues</p>
                </div>
                <Switch
                  checked={settings.allowGuestComments}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowGuestComments: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Progress Publicly</Label>
                  <p className="text-sm text-muted-foreground">Project progress visible to all members</p>
                </div>
                <Switch
                  checked={settings.showProgress}
                  onCheckedChange={(checked) => setSettings({ ...settings, showProgress: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Role for New Members</Label>
                <Select defaultValue="employee">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="stakeholder">Stakeholder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="danger" className="space-y-4">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible and destructive actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-destructive">Delete Project</Label>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this project and all its data
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Project
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the project
                          "{project.name}" and remove all associated data including issues, comments,
                          and time logs.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete Project
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ProjectSettings;
