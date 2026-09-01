import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { SprintTimeline } from '@/components/Sprint/SprintTimeline';
import { SprintBoard } from '@/components/Sprint/SprintBoard';
import { SprintReports } from '@/components/Sprint/SprintReports';

const TABS = ['timeline', 'board', 'reports'] as const;
type TabKey = (typeof TABS)[number];

const STORAGE_KEY = 'kaam-sprint-project';

const Sprints = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { canManageAll } = useUserRoles();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string>(localStorage.getItem(STORAGE_KEY) || '');

  const activeTab: TabKey = (TABS as readonly string[]).includes(tab || '') ? (tab as TabKey) : 'timeline';

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status')
        .order('created_at', { ascending: false });
      const rows = (data || []).filter((p) => p.status !== 'closed').map((p) => ({ id: p.id, name: p.name }));
      setProjects(rows);
      setProjectId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id || ''));
    })();
  }, []);

  useEffect(() => {
    if (projectId) localStorage.setItem(STORAGE_KEY, projectId);
  }, [projectId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sprints</h1>
          <p className="text-muted-foreground">
            Track every task on a timeline, run the active board and review results.
          </p>
        </div>
        {activeTab !== 'timeline' && (
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select a project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/app/sprints/${v}`)}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="board">Active Sprint Board</TabsTrigger>
          <TabsTrigger value="reports">Sprint Reports</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'timeline' ? (
        <SprintTimeline />
      ) : !projectId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Create a project first to start planning sprints.
          </CardContent>
        </Card>
      ) : activeTab === 'board' ? (
        <SprintBoard key={projectId} projectId={projectId} canManage={canManageAll} />
      ) : (
        <SprintReports key={projectId} projectId={projectId} />
      )}
    </div>
  );
};

export default Sprints;
