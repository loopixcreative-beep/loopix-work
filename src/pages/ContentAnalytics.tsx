import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subWeeks, startOfWeek, isSameWeek } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

import {
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  Activity,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Analytics {
  totalIssues: number;
  completedIssues: number;
  pendingApproval: number;
  approvedContent: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byProject: Record<string, number>;
  completionRate: number;
  approvalRate: number;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function ContentAnalytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [projects, setProjects] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<{ week: string; created: number; completed: number }[]>([]);


  useEffect(() => {
    fetchProjects();
    fetchAnalytics();
  }, [projectFilter]);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name, key");
    setProjects(data || []);
  };

  const fetchAnalytics = async () => {
    setLoading(true);

    let query = supabase.from("issues").select(`
      id,
      issue_type,
      status,
      priority,
      approval_status,
      project_id,
      created_at,
      updated_at,
      projects (name, key)
    `);


    if (projectFilter !== "all") {
      query = query.eq("project_id", projectFilter);
    }

    const { data: issues, error } = await query;

    if (error) {
      toast.error("Failed to fetch analytics");
      setLoading(false);
      return;
    }

    // Calculate analytics
    const totalIssues = issues?.length || 0;
    const completedIssues =
      issues?.filter((i) => i.status === "done").length || 0;
    const pendingApproval =
      issues?.filter((i) => i.approval_status === "pending_approval").length ||
      0;
    const approvedContent =
      issues?.filter((i) => i.approval_status === "approved").length || 0;

    // Group by type
    const byType: Record<string, number> = {};
    issues?.forEach((issue) => {
      byType[issue.issue_type] = (byType[issue.issue_type] || 0) + 1;
    });

    // Group by status
    const byStatus: Record<string, number> = {};
    issues?.forEach((issue) => {
      byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    });

    // Group by priority
    const byPriority: Record<string, number> = {};
    issues?.forEach((issue) => {
      byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;
    });

    // Group by project
    const byProject: Record<string, number> = {};
    issues?.forEach((issue) => {
      const projectName = issue.projects?.name || "Unknown";
      byProject[projectName] = (byProject[projectName] || 0) + 1;
    });

    // 12-week delivery trend
    const now = new Date();
    setTrendData(
      Array.from({ length: 12 }).map((_, idx) => {
        const weekStart = startOfWeek(subWeeks(now, 11 - idx));
        return {
          week: format(weekStart, "MMM d"),
          created: (issues || []).filter(
            (i: any) => i.created_at && isSameWeek(new Date(i.created_at), weekStart)
          ).length,
          completed: (issues || []).filter(
            (i: any) => i.status === "done" && i.updated_at && isSameWeek(new Date(i.updated_at), weekStart)
          ).length,
        };
      })
    );

    const completionRate =
      totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;
    const approvalRate =
      totalIssues > 0 ? (approvedContent / totalIssues) * 100 : 0;


    setAnalytics({
      totalIssues,
      completedIssues,
      pendingApproval,
      approvedContent,
      byType,
      byStatus,
      byPriority,
      byProject,
      completionRate,
      approvalRate,
    });

    setLoading(false);
  };

  if (loading || !analytics) {
    return (
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
    );
  }

  const typeChartData = Object.entries(analytics.byType).map(
    ([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
    })
  );

  const statusChartData = Object.entries(analytics.byStatus).map(
    ([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
    })
  );

  const priorityChartData = Object.entries(analytics.byPriority).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const projectChartData = Object.entries(analytics.byProject).map(
    ([name, value]) => ({
      name,
      issues: value,
    })
  );

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Content Analytics</h1>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total content"
            value={analytics.totalIssues}
            icon={BarChart3}
            tone="blue"
          />
          <StatCard
            label="Completed"
            value={analytics.completedIssues}
            hint={`${analytics.completionRate.toFixed(1)}% completion rate`}
            icon={CheckCircle}
            tone="green"
            progress={analytics.completionRate}
          />
          <StatCard
            label="In progress"
            value={analytics.byStatus["in_progress"] || 0}
            icon={Activity}
            tone="sky"
          />
          <StatCard
            label="Pending approval"
            value={analytics.pendingApproval}
            icon={Clock}
            tone="amber"
          />
          <StatCard
            label="Approved"
            value={analytics.approvedContent}
            hint={`${analytics.approvalRate.toFixed(1)}% approval rate`}
            icon={TrendingUp}
            tone="orange"
            progress={analytics.approvalRate}
          />
          <StatCard
            label="High priority"
            value={
              (analytics.byPriority["highest"] || 0) +
              (analytics.byPriority["high"] || 0)
            }
            icon={AlertCircle}
            tone="violet"
          />
        </div>


        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Content by Type</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Priority Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {priorityChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Content by Project</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="issues" radius={[8, 8, 0, 0]} fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Delivery trend */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-1">Delivery Trend</h2>
          <p className="mb-4 text-sm text-muted-foreground">Content created vs completed over the last 12 weeks</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="aCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend />
              <Area type="monotone" dataKey="created" name="Created" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#aCreated)" />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#aDone)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
  );
}

