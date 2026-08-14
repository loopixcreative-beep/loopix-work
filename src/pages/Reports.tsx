import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';

import { BarChart3, TrendingUp, Clock, Users, Download, Filter, Target, AlertCircle, CheckCircle2, Timer, Award, Zap, Calendar, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, parseISO } from 'date-fns';
import { exportToWord, exportToExcel } from '@/utils/reportExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Project {
  id: string;
  name: string;
}

interface UserPerformance {
  userId: string;
  name: string;
  email: string;
  issuesCompleted: number;
  issuesInProgress: number;
  hoursLogged: number;
  avgTimeToComplete: number;
  efficiency: number;
  workload: number;
  onTimeDelivery: number;
}

interface PendingTask {
  id: string;
  title: string;
  priority: string;
  assignee: string;
  dueDate: string | null;
  daysOverdue: number;
  project: string;
}

interface CycleTimeData {
  date: string;
  avgCycleTime: number;
  throughput: number;
}

interface ReportData {
  projectStats: {
    total: number;
    active: number;
    completed: number;
    avgCycleTime: number;
    throughput: number;
    byType: Record<string, number>;
  };
  issueStats: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    overdueTasks: number;
    pendingTasks: PendingTask[];
  };
  velocityData: Array<{
    date: string;
    completed: number;
    created: number;
  }>;
  burndownData: Array<{
    date: string;
    remaining: number;
    ideal: number;
  }>;
  teamPerformance: UserPerformance[];
  workloadDistribution: Array<{
    name: string;
    current: number;
    capacity: number;
    utilization: number;
  }>;
  cycleTimeData: CycleTimeData[];
  priorityAnalysis: Array<{
    priority: string;
    count: number;
    avgTimeToComplete: number;
    completionRate: number;
  }>;
}

const Reports = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [reportData, setReportData] = useState<ReportData>({
    projectStats: { total: 0, active: 0, completed: 0, avgCycleTime: 0, throughput: 0, byType: {} },
    issueStats: { total: 0, byStatus: {}, byPriority: {}, byType: {}, overdueTasks: 0, pendingTasks: [] },
    velocityData: [],
    burndownData: [],
    teamPerformance: [],
    workloadDistribution: [],
    cycleTimeData: [],
    priorityAnalysis: [],
  });
  const [loading, setLoading] = useState(true);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))'];

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [selectedProject, dateRange]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch project statistics
      let projectQuery = supabase.from('projects').select('*');
      if (selectedProject !== 'all') {
        projectQuery = projectQuery.eq('id', selectedProject);
      }
      const { data: projectsData } = await projectQuery;

      // Fetch all issues (not just within date range for comprehensive analysis)
      let allIssuesQuery = supabase
        .from('issues')
        .select('*, assignee:profiles!issues_assignee_id_fkey(user_id, full_name, email), project:projects(name)');
      
      if (selectedProject !== 'all') {
        allIssuesQuery = allIssuesQuery.eq('project_id', selectedProject);
      }
      
      const { data: allIssuesData } = await allIssuesQuery;

      // Fetch issues within date range for time-based analytics
      let issuesQuery = supabase
        .from('issues')
        .select('*, assignee:profiles!issues_assignee_id_fkey(user_id, full_name, email), project:projects(name)')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
      
      if (selectedProject !== 'all') {
        issuesQuery = issuesQuery.eq('project_id', selectedProject);
      }
      
      const { data: issuesData } = await issuesQuery;

      // Fetch time logs for team performance
      let timeLogsQuery = supabase
        .from('time_logs')
        .select('*, user:profiles(user_id, full_name, email), issue:issues(project_id, status, created_at, updated_at)')
        .gte('logged_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('logged_date', format(dateRange.to, 'yyyy-MM-dd'));

      const { data: timeLogsData } = await timeLogsQuery;

      // Fetch all profiles for workload analysis
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      // Calculate comprehensive metrics
      const completedIssues = allIssuesData?.filter(issue => issue.status === 'done') || [];
      const avgCycleTime = calculateAverageCycleTime(completedIssues);
      const throughput = completedIssues.length;

      // Calculate project type distribution
      const projectTypeStats: Record<string, number> = {};
      projectsData?.forEach(project => {
        const typeName = project.type || 'unknown';
        projectTypeStats[typeName] = (projectTypeStats[typeName] || 0) + 1;
      });

      // Process the data
      const processedData: ReportData = {
        projectStats: {
          total: projectsData?.length || 0,
          active: projectsData?.length || 0,
          completed: 0,
          avgCycleTime,
          throughput,
          byType: projectTypeStats,
        },
        issueStats: {
          total: issuesData?.length || 0,
          byStatus: {},
          byPriority: {},
          byType: {},
          overdueTasks: 0,
          pendingTasks: [],
        },
        velocityData: generateVelocityData(issuesData || []),
        burndownData: generateBurndownData(issuesData || []),
        teamPerformance: generateAdvancedTeamPerformance(allIssuesData || [], timeLogsData || [], profilesData || []),
        workloadDistribution: generateWorkloadDistribution(allIssuesData || [], profilesData || []),
        cycleTimeData: generateCycleTimeData(allIssuesData || []),
        priorityAnalysis: generatePriorityAnalysis(allIssuesData || []),
      };

      // Process issue statistics
      let overdueTasks = 0;
      const pendingTasks: PendingTask[] = [];

      issuesData?.forEach(issue => {
        processedData.issueStats.byStatus[issue.status] = 
          (processedData.issueStats.byStatus[issue.status] || 0) + 1;
        processedData.issueStats.byPriority[issue.priority] = 
          (processedData.issueStats.byPriority[issue.priority] || 0) + 1;
        processedData.issueStats.byType[issue.issue_type] = 
          (processedData.issueStats.byType[issue.issue_type] || 0) + 1;

        // Check for overdue and pending tasks
        if (issue.status !== 'done' && issue.due_date) {
          const dueDate = new Date(issue.due_date);
          const now = new Date();
          const daysOverdue = differenceInDays(now, dueDate);
          
          if (daysOverdue > 0) {
            overdueTasks++;
          }

          if (issue.status === 'to_do' || issue.status === 'in_progress') {
            pendingTasks.push({
              id: issue.id,
              title: issue.title,
              priority: issue.priority,
              assignee: issue.assignee?.full_name || issue.assignee?.email || 'Unassigned',
              dueDate: issue.due_date,
              daysOverdue: Math.max(0, daysOverdue),
              project: issue.project?.name || 'Unknown',
            });
          }
        }
      });

      processedData.issueStats.overdueTasks = overdueTasks;
      processedData.issueStats.pendingTasks = pendingTasks.sort((a, b) => b.daysOverdue - a.daysOverdue);

      setReportData(processedData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateVelocityData = (issues: any[]) => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const created = issues.filter(issue => 
        format(new Date(issue.created_at), 'yyyy-MM-dd') === dayStr
      ).length;
      const completed = issues.filter(issue => 
        issue.status === 'done' && 
        format(new Date(issue.updated_at), 'yyyy-MM-dd') === dayStr
      ).length;
      
      return {
        date: format(day, 'MMM dd'),
        created,
        completed,
      };
    });
  };

  const generateBurndownData = (issues: any[]) => {
    const totalIssues = issues.length;
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return days.map((day, index) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const completedByDay = issues.filter(issue => 
        issue.status === 'done' && 
        new Date(issue.updated_at) <= day
      ).length;
      
      const remaining = totalIssues - completedByDay;
      const ideal = totalIssues - (totalIssues * (index / (days.length - 1)));
      
      return {
        date: format(day, 'MMM dd'),
        remaining,
        ideal: Math.max(0, Math.round(ideal)),
      };
    });
  };

  const calculateAverageCycleTime = (issues: any[]) => {
    const completedIssues = issues.filter(issue => 
      issue.status === 'done' && issue.created_at && issue.updated_at
    );
    
    if (completedIssues.length === 0) return 0;
    
    const totalCycleTime = completedIssues.reduce((sum, issue) => {
      const created = new Date(issue.created_at);
      const completed = new Date(issue.updated_at);
      return sum + differenceInDays(completed, created);
    }, 0);
    
    return Math.round(totalCycleTime / completedIssues.length);
  };

  const generateAdvancedTeamPerformance = (issues: any[], timeLogs: any[], profiles: any[]): UserPerformance[] => {
    const teamMap = new Map<string, UserPerformance>();
    
    // Initialize all team members
    profiles.forEach(profile => {
      teamMap.set(profile.user_id, {
        userId: profile.user_id,
        name: profile.full_name || profile.email,
        email: profile.email,
        issuesCompleted: 0,
        issuesInProgress: 0,
        hoursLogged: 0,
        avgTimeToComplete: 0,
        efficiency: 0,
        workload: 0,
        onTimeDelivery: 0,
      });
    });

    // Calculate completed issues and cycle times
    const completedIssues = issues.filter(issue => issue.status === 'done');
    const inProgressIssues = issues.filter(issue => issue.status === 'in_progress');
    
    completedIssues.forEach(issue => {
      if (issue.assignee_id && teamMap.has(issue.assignee_id)) {
        const member = teamMap.get(issue.assignee_id)!;
        member.issuesCompleted += 1;
        
        // Calculate time to complete
        if (issue.created_at && issue.updated_at) {
          const cycleTime = differenceInDays(new Date(issue.updated_at), new Date(issue.created_at));
          member.avgTimeToComplete = 
            (member.avgTimeToComplete * (member.issuesCompleted - 1) + cycleTime) / member.issuesCompleted;
        }
        
        // Check on-time delivery
        if (issue.due_date) {
          const dueDate = new Date(issue.due_date);
          const completedDate = new Date(issue.updated_at);
          if (completedDate <= dueDate) {
            member.onTimeDelivery += 1;
          }
        }
      }
    });

    inProgressIssues.forEach(issue => {
      if (issue.assignee_id && teamMap.has(issue.assignee_id)) {
        teamMap.get(issue.assignee_id)!.issuesInProgress += 1;
      }
    });

    // Calculate hours logged and efficiency
    timeLogs.forEach(log => {
      if (log.user_id && teamMap.has(log.user_id)) {
        const member = teamMap.get(log.user_id)!;
        member.hoursLogged += parseFloat(log.hours_logged) || 0;
      }
    });

    // Calculate efficiency and workload
    Array.from(teamMap.values()).forEach(member => {
      member.workload = member.issuesCompleted + member.issuesInProgress;
      member.efficiency = member.hoursLogged > 0 ? 
        (member.issuesCompleted / member.hoursLogged) * 10 : 0;
      member.onTimeDelivery = member.issuesCompleted > 0 ? 
        (member.onTimeDelivery / member.issuesCompleted) * 100 : 0;
    });
    
    return Array.from(teamMap.values())
      .filter(member => member.issuesCompleted > 0 || member.issuesInProgress > 0 || member.hoursLogged > 0)
      .sort((a, b) => b.efficiency - a.efficiency);
  };

  const generateWorkloadDistribution = (issues: any[], profiles: any[]) => {
    const workloadMap = new Map();
    
    profiles.forEach(profile => {
      workloadMap.set(profile.user_id, {
        name: profile.full_name || profile.email,
        current: 0,
        capacity: 40, // Assuming 40 hours per week capacity
        utilization: 0,
      });
    });
    
    issues.filter(issue => issue.status !== 'done').forEach(issue => {
      if (issue.assignee_id && workloadMap.has(issue.assignee_id)) {
        const estimatedHours = issue.estimated_hours || 8; // Default 8 hours if not estimated
        workloadMap.get(issue.assignee_id).current += estimatedHours;
      }
    });
    
    Array.from(workloadMap.values()).forEach(member => {
      member.utilization = (member.current / member.capacity) * 100;
    });
    
    return Array.from(workloadMap.values()).sort((a, b) => b.utilization - a.utilization);
  };

  const generateCycleTimeData = (issues: any[]): CycleTimeData[] => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const completedIssues = issues.filter(issue => 
        issue.status === 'done' && 
        format(new Date(issue.updated_at), 'yyyy-MM-dd') === dayStr
      );
      
      const avgCycleTime = completedIssues.length > 0 ? 
        completedIssues.reduce((sum, issue) => {
          const created = new Date(issue.created_at);
          const completed = new Date(issue.updated_at);
          return sum + differenceInDays(completed, created);
        }, 0) / completedIssues.length : 0;
      
      return {
        date: format(day, 'MMM dd'),
        avgCycleTime: Math.round(avgCycleTime),
        throughput: completedIssues.length,
      };
    });
  };

  const generatePriorityAnalysis = (issues: any[]) => {
    const priorities = ['low', 'medium', 'high', 'urgent'];
    
    return priorities.map(priority => {
      const priorityIssues = issues.filter(issue => issue.priority === priority);
      const completedIssues = priorityIssues.filter(issue => issue.status === 'done');
      
      const avgTimeToComplete = completedIssues.length > 0 ? 
        completedIssues.reduce((sum, issue) => {
          const created = new Date(issue.created_at);
          const completed = new Date(issue.updated_at);
          return sum + differenceInDays(completed, created);
        }, 0) / completedIssues.length : 0;
      
      return {
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        count: priorityIssues.length,
        avgTimeToComplete: Math.round(avgTimeToComplete),
        completionRate: priorityIssues.length > 0 ? 
          (completedIssues.length / priorityIssues.length) * 100 : 0,
      };
    });
  };

  const exportReport = () => {
    // Export functionality implemented
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Track project progress, team performance, and key metrics
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportToWord(reportData, selectedProject !== 'all' ? projects.find(p => p.id === selectedProject)?.name : undefined)}>
              Export as Word (.docx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToExcel(reportData, selectedProject !== 'all' ? projects.find(p => p.id === selectedProject)?.name : undefined)}>
              Export as Excel (.xlsx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DatePickerWithRange
              value={dateRange}
              onChange={setDateRange}
              className="w-full sm:w-auto"
            />
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total issues"
          value={reportData.issueStats.total}
          icon={BarChart3}
          tone="blue"
        />
        <StatCard
          label="Completed"
          value={reportData.issueStats.byStatus['done'] || 0}
          hint={`${reportData.issueStats.total ? Math.round(((reportData.issueStats.byStatus['done'] || 0) / reportData.issueStats.total) * 100) : 0}% of all issues`}
          icon={CheckCircle2}
          tone="green"
          progress={reportData.issueStats.total ? ((reportData.issueStats.byStatus['done'] || 0) / reportData.issueStats.total) * 100 : 0}
        />
        <StatCard
          label="In progress"
          value={reportData.issueStats.byStatus['in_progress'] || 0}
          icon={Activity}
          tone="sky"
          progress={reportData.issueStats.total ? ((reportData.issueStats.byStatus['in_progress'] || 0) / reportData.issueStats.total) * 100 : 0}
        />
        <StatCard
          label="Overdue"
          value={reportData.issueStats.overdueTasks}
          icon={AlertCircle}
          tone="orange"
        />
        <StatCard
          label="Avg cycle time"
          value={`${reportData.projectStats.avgCycleTime}d`}
          icon={Timer}
          tone="violet"
        />
        <StatCard
          label="Throughput"
          value={reportData.projectStats.throughput}
          hint="issues completed / period"
          icon={Zap}
          tone="amber"
        />
      </div>


      {/* Charts */}
      <Tabs defaultValue="velocity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="velocity">Velocity</TabsTrigger>
          <TabsTrigger value="burndown">Burndown</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="cycletime">Cycle Time</TabsTrigger>
          <TabsTrigger value="priority">Priority Analysis</TabsTrigger>
          <TabsTrigger value="pending">Pending Tasks</TabsTrigger>
        </TabsList>
        
        <TabsContent value="velocity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Velocity</CardTitle>
              <CardDescription>Issues created vs completed over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.velocityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="created" fill="hsl(var(--chart-1))" name="Created" />
                  <Bar dataKey="completed" fill="hsl(var(--chart-2))" name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="burndown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Burndown Chart</CardTitle>
              <CardDescription>Remaining work vs ideal progress</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData.burndownData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="remaining" stroke="hsl(var(--chart-1))" name="Remaining" />
                  <Line type="monotone" dataKey="ideal" stroke="hsl(var(--chart-2))" strokeDasharray="5 5" name="Ideal" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>By Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(reportData.issueStats.byStatus).map(([key, value]) => ({
                        name: key.replace('_', ' ').toUpperCase(),
                        value
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={60}
                      fill="hsl(var(--chart-1))"
                      dataKey="value"
                    >
                      {Object.entries(reportData.issueStats.byStatus).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>By Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(reportData.issueStats.byPriority).map(([key, value]) => ({
                        name: key.toUpperCase(),
                        value
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={60}
                      fill="hsl(var(--chart-1))"
                      dataKey="value"
                    >
                      {Object.entries(reportData.issueStats.byPriority).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>By Issue Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(reportData.issueStats.byType).map(([key, value]) => ({
                        name: key.toUpperCase(),
                        value
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={60}
                      fill="hsl(var(--chart-1))"
                      dataKey="value"
                    >
                      {Object.entries(reportData.issueStats.byType).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Project Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(reportData.projectStats.byType).map(([key, value]) => ({
                        name: key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        value
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={60}
                      fill="hsl(var(--chart-1))"
                      dataKey="value"
                      label
                    >
                      {Object.entries(reportData.projectStats.byType).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Performance Analytics</CardTitle>
              <CardDescription>Comprehensive performance metrics for each team member</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {reportData.teamPerformance.map((member, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Badge variant="secondary">
                          Efficiency: {member.efficiency.toFixed(1)}
                        </Badge>
                        <Badge variant={member.onTimeDelivery >= 80 ? "default" : "destructive"}>
                          On-time: {member.onTimeDelivery.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-semibold">{member.issuesCompleted}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">In Progress</p>
                        <p className="font-semibold">{member.issuesInProgress}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hours Logged</p>
                        <p className="font-semibold">{member.hoursLogged.toFixed(1)}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Cycle Time</p>
                        <p className="font-semibold">{member.avgTimeToComplete.toFixed(1)}d</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Workload</p>
                        <p className="font-semibold">{member.workload} tasks</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {reportData.teamPerformance.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No team performance data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workload Distribution</CardTitle>
              <CardDescription>Current workload and capacity utilization across team members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.workloadDistribution.map((member, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{member.name}</span>
                      <div className="flex items-center space-x-2 text-sm">
                        <span>{member.current}h / {member.capacity}h</span>
                        <Badge variant={member.utilization > 100 ? "destructive" : member.utilization > 80 ? "secondary" : "default"}>
                          {member.utilization.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={Math.min(member.utilization, 100)} className="h-2" />
                  </div>
                ))}
                
                {reportData.workloadDistribution.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No workload data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycletime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cycle Time & Throughput Analysis</CardTitle>
              <CardDescription>Track delivery speed and throughput over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={reportData.cycleTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="avgCycleTime" 
                    stackId="1"
                    stroke="hsl(var(--chart-1))" 
                    fill="hsl(var(--chart-1))" 
                    fillOpacity={0.6}
                    name="Avg Cycle Time (days)"
                  />
                  <Bar 
                    yAxisId="right"
                    dataKey="throughput" 
                    fill="hsl(var(--chart-2))" 
                    name="Throughput"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="priority" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Priority-Based Analysis</CardTitle>
              <CardDescription>Performance metrics segmented by task priority</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.priorityAnalysis.map((priority, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          priority.priority === 'Urgent' ? "destructive" :
                          priority.priority === 'High' ? "secondary" :
                          priority.priority === 'Medium' ? "default" : "outline"
                        }>
                          {priority.priority}
                        </Badge>
                        <span className="font-medium">{priority.count} tasks</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {priority.completionRate.toFixed(1)}% completion rate
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Avg Time to Complete</p>
                        <p className="font-semibold">{priority.avgTimeToComplete} days</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completion Progress</p>
                        <Progress value={priority.completionRate} className="h-2 mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Tasks & Overdue Analysis</CardTitle>
              <CardDescription>Tasks requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportData.issueStats.pendingTasks.length > 0 ? (
                  reportData.issueStats.pendingTasks.slice(0, 10).map((task, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{task.title}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {task.project}
                          </Badge>
                          <Badge 
                            variant={
                              task.priority === 'urgent' ? "destructive" :
                              task.priority === 'high' ? "secondary" : "default"
                            }
                            className="text-xs"
                          >
                            {task.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{task.assignee}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {task.daysOverdue > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {task.daysOverdue} days overdue
                          </Badge>
                        )}
                        {task.dueDate && task.daysOverdue === 0 && (
                          <Badge variant="outline" className="text-xs">
                            Due: {format(new Date(task.dueDate), 'MMM dd')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No pending tasks found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;