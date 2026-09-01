import { Linkify } from '@/components/ui/linkify';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Settings, Users, Calendar, BarChart3 } from 'lucide-react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import KanbanBoard from '@/components/Project/KanbanBoard';
import IssuesList from '@/components/Project/IssuesList';
import SprintManagement from '@/components/Project/SprintManagement';
import ProjectInvitations from '@/components/Project/ProjectInvitations';
import ProjectMembers from '@/components/Project/ProjectMembers';
import ProjectReports from '@/components/Project/ProjectReports';

interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  type: string;
  status: string;
  lead_id: string;
  created_by: string;
  created_at: string;
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

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { canManageAll } = useUserRoles();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const canCloseProject = () =>
    !!project && (canManageAll || project.lead_id === user?.id || project.created_by === user?.id);

  const toggleProjectStatus = async () => {
    if (!project) return;
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
      fetchProject();
    } catch (error: any) {
      toast({ title: 'Error', description: friendlyErrorMessage(error), variant: 'destructive' });
    }
  };

  const fetchProject = async () => {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          lead:profiles!projects_lead_id_fkey(full_name, email, avatar_url)
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Fetch issue stats
      const { data: issuesData } = await supabase
        .from('issues')
        .select('status')
        .eq('project_id', projectId);

      const completedCount = issuesData?.filter(issue => issue.status === 'done').length || 0;
      const inProgressCount = issuesData?.filter(issue => issue.status === 'in_progress').length || 0;

      setProject({
        ...projectData,
        issueStats: {
          total: issuesData?.length || 0,
          completed: completedCount,
          inProgress: inProgressCount,
        },
      });
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-semibold">Project not found</h2>
        <p className="text-muted-foreground mt-2">The project you're looking for doesn't exist.</p>
        <Button asChild className="mt-4">
          <Link to="/app/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const progress = project.issueStats.total > 0 
    ? Math.round((project.issueStats.completed / project.issueStats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 h-8 w-fit px-2 text-muted-foreground hover:text-foreground"
        >
          <Link to="/app/projects">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <Badge className={getProjectTypeColor(project.type)}>
                {project.type.replace('_', ' ').toUpperCase()}
              </Badge>
              {project.status === 'closed' && (
                <Badge variant="outline" className="border-brand-orange text-brand-orange">
                  CLOSED
                </Badge>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{project.key} • <Linkify text={project.description} /></p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canCloseProject() && (
              <Button variant="outline" onClick={toggleProjectStatus}>
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
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to={`/app/projects/${project.id}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/app/projects/${project.id}/issues/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Create Issue
              </Link>
            </Button>
          </div>
        </div>
      </div>


      {/* Project Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total Issues</span>
            </div>
            <p className="text-2xl font-bold mt-2">{project.issueStats.total}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold mt-2">{project.issueStats.completed}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium">In Progress</span>
            </div>
            <p className="text-2xl font-bold mt-2">{project.issueStats.inProgress}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="board" className="space-y-4">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          {project.type === 'scrum' && <TabsTrigger value="sprints">Sprints</TabsTrigger>}
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="board" className="space-y-4">
          <KanbanBoard projectId={project.id} />
        </TabsContent>
        
        <TabsContent value="issues" className="space-y-4">
          <IssuesList projectId={project.id} />
        </TabsContent>
        
        {project.type === 'scrum' && (
          <TabsContent value="sprints" className="space-y-4">
            <SprintManagement projectId={project.id} />
          </TabsContent>
        )}
        
        <TabsContent value="team" className="space-y-4">
          <ProjectMembers projectId={project.id} leadId={project.lead_id} />
          <ProjectInvitations projectId={project.id} />
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <ProjectReports projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectDetail;