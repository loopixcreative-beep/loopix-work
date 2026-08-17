import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, MoreHorizontal, Users, Calendar, Trash2, CheckCircle2, RotateCcw, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  type: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  lead_id: string;
  created_by: string;
  lead: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
  issueStats: {
    total: number;
    completed: number;
    inProgress: number;
  };
}

const Projects = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { canManageAll } = useUserRoles();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          lead:profiles!projects_lead_id_fkey(full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch issue stats for each project
      const { data: issuesData } = await supabase
        .from('issues')
        .select('project_id, status');

      const projectsWithStats = projectsData?.map(project => {
        const projectIssues = issuesData?.filter(issue => issue.project_id === project.id) || [];
        const completedCount = projectIssues.filter(issue => issue.status === 'done').length;
        const inProgressCount = projectIssues.filter(issue => issue.status === 'in_progress').length;

        return {
          ...project,
          issueStats: {
            total: projectIssues.length,
            completed: completedCount,
            inProgress: inProgressCount,
          },
        };
      }) || [];

      setProjects(projectsWithStats);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeProjects = projects.filter((p) => p.status !== 'closed');
  const closedProjects = projects.filter((p) => p.status === 'closed');

  const canCloseProject = (project: Project) =>
    canManageAll || project.lead_id === user?.id || project.created_by === user?.id;

  const toggleProjectStatus = async (project: Project) => {
    const nextStatus = project.status === 'closed' ? 'active' : 'closed';
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          status: nextStatus,
          closed_at: nextStatus === 'closed' ? new Date().toISOString() : null,
          closed_by: nextStatus === 'closed' ? user?.id ?? null : null,
        } as any)
        .eq('id', project.id);
      if (error) throw error;
      toast({
        title: nextStatus === 'closed' ? 'Project closed' : 'Project reopened',
        description: `${project.name} is now ${nextStatus}.`,
      });
      fetchProjects();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyErrorMessage(error), variant: 'destructive' });
    }
  };

  const renderProjectCard = (project: Project) => {
    const progress = project.issueStats.total > 0
      ? Math.round((project.issueStats.completed / project.issueStats.total) * 100)
      : 0;

    return (

            <Card key={project.id} className="group hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                      <Link to={`/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getProjectTypeColor(project.type)}`}
                      >
                        {project.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {project.key}
                      </span>
                      {project.status === 'closed' && (
                        <Badge variant="outline" className="text-xs">Closed</Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/projects/${project.id}`}>View Project</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/projects/${project.id}/board`}>Open Board</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/projects/${project.id}/settings`}>Settings</Link>
                      </DropdownMenuItem>
                      {canCloseProject(project) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleProjectStatus(project)}>
                            {project.status === 'closed' ? (
                              <>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reopen Project
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Close Project
                              </>
                            )}
                          </DropdownMenuItem>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setProjectToDelete(project.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Project
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {project.description && (
                  <CardDescription className="text-sm line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{project.issueStats.completed} completed</span>
                    <span>{project.issueStats.total} total issues</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-muted-foreground">Lead:</span>
                    {project.lead ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          size="xs"
                          name={project.lead.full_name}
                          email={project.lead.email}
                          avatarUrl={project.lead.avatar_url}
                        />
                        <span className="font-medium">
                          {project.lead.full_name || project.lead.email}
                        </span>
                      </span>
                    ) : (
                      <span className="font-medium">Unassigned</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Created {format(new Date(project.created_at), 'MMM dd, yyyy')}</span>
                </div>
              </CardContent>
            </Card>
    );
  };

  const getProjectTypeColor = (type: string) => {
    switch (type) {
      case 'scrum':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'kanban':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'business':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'it_service':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete);

      if (error) throw error;

      toast({
        title: 'Project Deleted',
        description: 'The project has been deleted successfully.',
      });

      fetchProjects();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: friendlyErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage and track your projects across your organization
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            Active
            <Badge variant="secondary" className="ml-2">{activeProjects.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="closed">
            <Archive className="mr-1.5 h-4 w-4" />
            Closed
            <Badge variant="secondary" className="ml-2">{closedProjects.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No active projects</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Create a new project or reopen a closed one to get started.
              </p>
              <Button className="mt-4" asChild>
                <Link to="/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create a project
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeProjects.map(renderProjectCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed" className="mt-6">
          {closedProjects.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Archive className="mx-auto mb-3 h-8 w-8" />
              <p className="text-sm">No closed projects yet.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {closedProjects.map(renderProjectCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
              All issues, sprints, and related data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;