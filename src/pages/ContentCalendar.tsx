import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { StatCard } from "@/components/ui/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, isThisWeek, isPast, differenceInCalendarDays } from "date-fns";
import { Calendar, CheckCircle, Clock, AlertCircle, CalendarClock, Flame, Layers, ThumbsUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";


interface Issue {
  id: string;
  title: string;
  issue_type: string;
  status: string;
  priority: string;
  due_date: string;
  approval_status: string;
  projects: {
    name: string;
    key: string;
  };
}

export default function ContentCalendar() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("issues")
      .select(
        `
        id,
        title,
        issue_type,
        status,
        priority,
        due_date,
        approval_status,
        projects (
          name,
          key
        )
      `
      )
      .not("due_date", "is", null)
      .order("due_date", { ascending: true });

    if (error) {
      toast.error("Failed to fetch content calendar");
      setLoading(false);
      return;
    }

    setIssues(data || []);
    setLoading(false);
  };

  const getIssuesForDate = (date: Date) => {
    return issues.filter((issue) => isSameDay(new Date(issue.due_date), date));
  };

  const getDatesWithIssues = () => {
    return issues.map((issue) => new Date(issue.due_date));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending_approval":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const selectedDateIssues = getIssuesForDate(selectedDate);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Content Calendar</h1>
            <p className="text-muted-foreground">
              View and manage your scheduled content
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-64 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-2/3"></div>
                <div className="h-24 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const thisWeek = issues.filter((i) => isThisWeek(new Date(i.due_date)));
  const overdue = issues.filter((i) => isPast(new Date(i.due_date)) && i.status !== "done");
  const published = issues.filter((i) => i.status === "done");
  const pending = issues.filter((i) => i.approval_status === "pending_approval");
  const approved = issues.filter((i) => i.approval_status === "approved");

  const typeCounts: Record<string, number> = {};
  issues.forEach((i) => {
    const t = i.issue_type.replace(/_/g, " ");
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const typeChart = Object.entries(typeCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const approvalChart = [
    { name: "Draft", value: issues.filter((i) => !i.approval_status || i.approval_status === "draft").length },
    { name: "Pending", value: pending.length },
    { name: "Approved", value: approved.length },
    { name: "Rejected", value: issues.filter((i) => i.approval_status === "rejected").length },
  ].filter((d) => d.value > 0);

  const monthCounts: Record<string, number> = {};
  issues.forEach((i) => {
    const m = format(new Date(i.due_date), "MMM yyyy");
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  const monthChart = Object.entries(monthCounts).map(([name, value]) => ({ name, value })).slice(0, 8);

  const CHART = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
  ];

  const upcomingSorted = issues
    .filter((i) => i.status !== "done" && !isPast(new Date(i.due_date)))
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">
            View and manage your scheduled content
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-4 py-2">
          <Calendar className="h-4 w-4 mr-2" />
          {issues.length} scheduled items
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Scheduled" value={issues.length} hint="Items with a due date" icon={Layers} tone="blue" />
        <StatCard label="This week" value={thisWeek.length} hint="Due within the week" icon={CalendarClock} tone="sky" />
        <StatCard label="Published" value={published.length} hint={`${issues.length ? Math.round((published.length / issues.length) * 100) : 0}% of pipeline`} icon={CheckCircle} tone="green" progress={issues.length ? (published.length / issues.length) * 100 : 0} />
        <StatCard label="Pending approval" value={pending.length} hint="Waiting on review" icon={Clock} tone="amber" />
        <StatCard label="Approved" value={approved.length} hint="Ready to ship" icon={ThumbsUp} tone="orange" />
        <StatCard label="Overdue" value={overdue.length} hint="Past due, still open" icon={Flame} tone="violet" />
      </div>



      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
            <CardDescription>Click on a date to view scheduled content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border p-2 sm:p-4">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="w-full p-0"
                classNames={{
                  months: "flex w-full flex-col",
                  month: "w-full space-y-4",
                  caption: "relative flex items-center justify-center pt-1",
                  caption_label: "text-base font-bold",
                  nav: "flex items-center gap-1",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "grid grid-cols-7",
                  head_cell:
                    "text-muted-foreground text-xs font-semibold uppercase tracking-wide w-full text-center",
                  row: "grid grid-cols-7 mt-1",
                  cell: "w-full p-0.5 text-center",
                  day: "mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-lg p-0 text-sm font-semibold hover:bg-accent",
                  day_selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  day_today: "ring-2 ring-brand-orange/60",
                  day_outside: "text-muted-foreground/40",
                }}
                modifiers={{
                  hasIssues: getDatesWithIssues(),
                }}
                modifiersClassNames={{
                  hasIssues:
                    "bg-primary/15 text-primary font-bold ring-1 ring-primary/30",
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-primary/25 ring-1 ring-primary/40" /> Has content
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-primary" /> Selected
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm ring-2 ring-brand-orange/60" /> Today
              </span>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>{format(selectedDate, "MMMM d, yyyy")}</CardTitle>
            <CardDescription>
              {selectedDateIssues.length} item{selectedDateIssues.length !== 1 ? "s" : ""} scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No content scheduled for this date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateIssues.map((issue) => (
                  <Card
                    key={issue.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => navigate(`/app/issues/${issue.id}`)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(issue.status)}
                          <p className="font-medium text-sm">{issue.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {issue.projects.key}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {issue.issue_type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            issue.priority === "high"
                              ? "destructive"
                              : issue.priority === "medium"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {issue.priority}
                        </Badge>
                        {getApprovalBadge(issue.approval_status)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Content Mix</CardTitle>
            <CardDescription>Scheduled items by content type</CardDescription>
          </CardHeader>
          <CardContent>
            {typeChart.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={typeChart} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {typeChart.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-16 text-center text-muted-foreground">No content yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval Pipeline</CardTitle>
            <CardDescription>Where content sits in review</CardDescription>
          </CardHeader>
          <CardContent>
            {approvalChart.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={approvalChart} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {approvalChart.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="py-16 text-center text-muted-foreground">No content yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publishing Load</CardTitle>
            <CardDescription>Scheduled items per month</CardDescription>
          </CardHeader>
          <CardContent>
            {monthChart.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-16 text-center text-muted-foreground">No content yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-destructive" />Overdue Content</CardTitle>
            <CardDescription>{overdue.length} item{overdue.length === 1 ? "" : "s"} past their publish date</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {overdue.slice(0, 6).map((issue) => (
                <li
                  key={issue.id}
                  className="flex cursor-pointer items-center gap-3 py-3 hover:bg-muted/50"
                  onClick={() => navigate(`/app/issues/${issue.id}`)}
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
                    <span className="text-[10px] font-semibold uppercase leading-none">{format(new Date(issue.due_date), "MMM")}</span>
                    <span className="text-sm font-bold leading-none">{format(new Date(issue.due_date), "d")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{issue.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {issue.projects?.name} · {Math.abs(differenceInCalendarDays(new Date(issue.due_date), new Date()))} days late
                    </p>
                  </div>
                  {getApprovalBadge(issue.approval_status)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Content</CardTitle>
          <CardDescription>Next scheduled items across all projects</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No upcoming content</h3>
              <p className="text-sm text-muted-foreground">
                Create issues with due dates to see them here
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {upcomingSorted.map((issue) => (
                <li
                  key={issue.id}
                  className="flex cursor-pointer items-center gap-3 py-3 hover:bg-muted/50"
                  onClick={() => navigate(`/app/issues/${issue.id}`)}
                >
                  {getStatusIcon(issue.status)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{issue.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {issue.projects?.name} · {issue.issue_type.replace(/_/g, " ")} · due {format(new Date(issue.due_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden text-xs sm:inline-flex">{issue.projects?.key}</Badge>
                  {getApprovalBadge(issue.approval_status)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

