import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useWorkTimer } from "@/hooks/useWorkTimer";
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Target,
  Clock,
  CheckCircle2,
  TrendingUp,
  Filter,
  Search,
  MessageSquare,
  Video,
  Building2,
  Activity
} from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  skills: string[];
  availability_status: string;
  team_department: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  created_at: string;
  coin_points: number;
  projectCount: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksToDo: number;
  totalHoursLogged: number;
  manualHours: number;
  trackedHours: number;
  weekHoursTracked: number;
  recentActivity: number;
}

const Teams = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"directory" | "leaderboard">("directory");
  const { onlineUsers, workingUsers } = useWorkTimer();

  const isOnline = (userId: string) => onlineUsers.has(userId) || workingUsers.has(userId);
  const isWorking = (userId: string) => workingUsers.has(userId);
  const presenceLabel = (userId: string) =>
    isWorking(userId) ? "Working now" : isOnline(userId) ? "Online" : "Offline";

  useEffect(() => {
    if (user) {
      fetchTeamMembers();
    }
  }, [user]);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (profilesError) throw profilesError;

      // Fetch project counts for each member
      const { data: projectAssignments, error: projectError } = await supabase
        .from("issues")
        .select("assignee_id, project_id");

      if (projectError) throw projectError;

      // Fetch task statistics
      const { data: issues, error: issuesError } = await supabase
        .from("issues")
        .select("assignee_id, status");

      if (issuesError) throw issuesError;

      // Fetch time logs
      const { data: timeLogs, error: timeLogsError } = await supabase
        .from("time_logs")
        .select("user_id, hours_logged");

      if (timeLogsError) throw timeLogsError;

      // Fetch tracked work sessions (timer feature)
      const { data: workSessions, error: workSessionsError } = await supabase
        .from("work_sessions")
        .select("user_id, started_at, ended_at, duration_seconds");

      if (workSessionsError) throw workSessionsError;

      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

      // Fetch recent activity (comments created in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentComments, error: commentsError } = await supabase
        .from("comments")
        .select("author_id")
        .gte("created_at", sevenDaysAgo.toISOString());

      if (commentsError) throw commentsError;

      // Process data for each member
      const membersData: TeamMember[] = (profiles || []).map((profile) => {
        const userProjects = new Set(
          projectAssignments
            ?.filter((pa) => pa.assignee_id === profile.user_id)
            .map((pa) => pa.project_id) || []
        );

        const userIssues = issues?.filter((i) => i.assignee_id === profile.user_id) || [];
        const tasksCompleted = userIssues.filter((i) => i.status === "done").length;
        const tasksInProgress = userIssues.filter((i) => i.status === "in_progress").length;
        const tasksToDo = userIssues.filter((i) => i.status === "to_do").length;

        const manualHours =
          timeLogs
            ?.filter((tl) => tl.user_id === profile.user_id)
            .reduce((sum, tl) => sum + Number(tl.hours_logged || 0), 0) || 0;

        const userSessions = workSessions?.filter((ws) => ws.user_id === profile.user_id) || [];
        const sessionSeconds = (from?: Date) =>
          userSessions.reduce((sum, ws) => {
            const start = new Date(ws.started_at).getTime();
            if (from && start < from.getTime()) return sum;
            const seconds = ws.ended_at
              ? Number(ws.duration_seconds ?? (new Date(ws.ended_at).getTime() - start) / 1000)
              : Math.max(0, (Date.now() - start) / 1000);
            return sum + Math.max(0, seconds);
          }, 0);

        const trackedHours = sessionSeconds() / 3600;
        const weekHoursTracked = sessionSeconds(weekStart) / 3600;
        const totalHoursLogged = manualHours + trackedHours;

        const recentActivity = recentComments?.filter((c) => c.author_id === profile.user_id).length || 0;

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name || "Unknown",
          email: profile.email,
          avatar_url: profile.avatar_url,
          role: profile.role,
          skills: profile.skills || [],
          availability_status: profile.availability_status || "available",
          team_department: profile.team_department,
          bio: profile.bio,
          phone: profile.phone,
          location: profile.location,
          created_at: profile.created_at,
          coin_points: profile.coin_points || 0,
          projectCount: userProjects.size,
          tasksCompleted,
          tasksInProgress,
          tasksToDo,
          totalHoursLogged,
          manualHours,
          trackedHours,
          weekHoursTracked,
          recentActivity,
        };
      });

      setMembers(membersData);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "busy":
        return "bg-yellow-500";
      case "on_leave":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getAvailabilityLabel = (status: string) => {
    return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.skills.some((skill) => skill.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = filterRole === "all" || member.role === filterRole;
    const matchesDepartment =
      filterDepartment === "all" || member.team_department === filterDepartment;

    return matchesSearch && matchesRole && matchesDepartment;
  });

  const departments = Array.from(new Set(members.map((m) => m.team_department).filter(Boolean)));
  const roles = Array.from(new Set(members.map((m) => m.role)));

  const openMemberProfile = (member: TeamMember) => {
    setSelectedMember(member);
    setIsProfileOpen(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const sortedByPoints = [...members].sort((a, b) => (b.coin_points || 0) - (a.coin_points || 0));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Manage and track your team's performance and availability
          </p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "directory" | "leaderboard")}>
        <TabsList>
          <TabsTrigger value="directory">Team Directory</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-6 mt-6">

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Now</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members.filter((m) => isOnline(m.user_id)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {members.filter((m) => isWorking(m.user_id)).length} timer running
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members.reduce((sum, m) => sum + m.projectCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members.reduce((sum, m) => sum + m.totalHoursLogged, 0).toFixed(1)}h
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept || ""}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Team Members Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member) => (
          <Card
            key={member.id}
            className="cursor-pointer transition-all hover:shadow-lg"
            onClick={() => openMemberProfile(member)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatar_url || ""} />
                      <AvatarFallback>
                        {member.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline(member.user_id) && (
                      <span
                        title={presenceLabel(member.user_id)}
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                          isWorking(member.user_id) ? "bg-green-500 animate-pulse" : "bg-green-500/60"
                        }`}
                      />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">{member.full_name}</CardTitle>
                    <CardDescription className="text-xs">{member.email}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={getRoleColor(member.role)}>{member.role}</Badge>
                {member.team_department && (
                  <Badge variant="outline">
                    <Building2 className="mr-1 h-3 w-3" />
                    {member.team_department}
                  </Badge>
                )}
              </div>

              {member.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {member.skills.slice(0, 3).map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {member.skills.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{member.skills.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projects:</span>
                  <span className="font-medium">{member.projectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasks Completed:</span>
                  <span className="font-medium">{member.tasksCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hours Logged:</span>
                  <span className="font-medium">
                    {member.totalHoursLogged.toFixed(1)}h
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({member.weekHoursTracked.toFixed(1)}h this week)
                    </span>
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Workload Distribution</span>
                </div>
                <Progress
                  value={
                    member.tasksCompleted + member.tasksInProgress + member.tasksToDo > 0
                      ? ((member.tasksCompleted + member.tasksInProgress) /
                          (member.tasksCompleted + member.tasksInProgress + member.tasksToDo)) *
                        100
                      : 0
                  }
                />
                <div className="flex justify-between text-xs">
                  <span className="text-green-500">{member.tasksCompleted} Done</span>
                  <span className="text-yellow-500">{member.tasksInProgress} In Progress</span>
                  <span className="text-muted-foreground">{member.tasksToDo} To Do</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMembers.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No team members found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        </Card>
      )}
      </TabsContent>

      <TabsContent value="leaderboard" className="space-y-6 mt-6">
        {/* Leaderboard Header */}
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Team Leaderboard
            </CardTitle>
            <CardDescription>
              Top contributors ranked by coin points earned from completed tasks
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Leaderboard Table */}
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {sortedByPoints.map((member, index) => (
                <div
                  key={member.id}
                  className={`flex items-center gap-4 p-4 transition-colors hover:bg-accent cursor-pointer ${
                    index < 3 ? "bg-primary/5" : ""
                  }`}
                  onClick={() => openMemberProfile(member)}
                >
                  {/* Rank Badge */}
                  <div className="flex items-center justify-center w-12 h-12">
                    {index === 0 && (
                      <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        1
                      </div>
                    )}
                    {index === 1 && (
                      <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        2
                      </div>
                    )}
                    {index === 2 && (
                      <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        3
                      </div>
                    )}
                    {index > 2 && (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                        {index + 1}
                      </div>
                    )}
                  </div>

                  {/* Member Info */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback>
                          {member.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline(member.user_id) && (
                        <span
                          title={presenceLabel(member.user_id)}
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                            isWorking(member.user_id) ? "bg-green-500 animate-pulse" : "bg-green-500/60"
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{member.full_name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-8 text-sm">
                    <div className="text-center">
                      <div className="font-semibold">{member.tasksCompleted}</div>
                      <div className="text-xs text-muted-foreground">Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{member.projectCount}</div>
                      <div className="text-xs text-muted-foreground">Projects</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{member.totalHoursLogged.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">Hours</div>
                    </div>
                  </div>

                  {/* Coin Points */}
                  <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
                    <Award className="h-5 w-5 text-primary" />
                    <span className="font-bold text-lg text-primary">{member.coin_points || 0}</span>
                  </div>
                </div>
              ))}

              {sortedByPoints.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No team members found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

      {/* Member Profile Modal */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedMember.avatar_url || ""} />
                    <AvatarFallback>
                      {selectedMember.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-2xl font-bold">{selectedMember.full_name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant={getRoleColor(selectedMember.role)}>
                        {selectedMember.role}
                      </Badge>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                          isOnline(selectedMember.user_id)
                            ? "bg-green-500/15 text-green-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${
                            isWorking(selectedMember.user_id)
                              ? "bg-green-500 animate-pulse"
                              : isOnline(selectedMember.user_id)
                              ? "bg-green-500/60"
                              : "bg-muted-foreground/50"
                          }`}
                        />
                        {presenceLabel(selectedMember.user_id)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getAvailabilityLabel(selectedMember.availability_status)}
                      </Badge>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedMember.email}`} className="text-primary hover:underline">
                          {selectedMember.email}
                        </a>
                      </div>
                      {selectedMember.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${selectedMember.phone}`} className="text-primary hover:underline">
                            {selectedMember.phone}
                          </a>
                        </div>
                      )}
                      {selectedMember.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMember.location}</span>
                        </div>
                      )}
                      {selectedMember.team_department && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMember.team_department}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Bio */}
                  {selectedMember.bio && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">About</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{selectedMember.bio}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Skills */}
                  {selectedMember.skills.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Skills & Expertise</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedMember.skills.map((skill, idx) => (
                            <Badge key={idx} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                      </Button>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                      <Button variant="outline" size="sm">
                        <Video className="mr-2 h-4 w-4" />
                        Video Call
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="performance" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Project Involvement</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{selectedMember.projectCount}</div>
                        <p className="text-xs text-muted-foreground">Active Projects</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{selectedMember.tasksCompleted}</div>
                        <p className="text-xs text-muted-foreground">Total Tasks Done</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {selectedMember.totalHoursLogged.toFixed(1)}h
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {selectedMember.trackedHours.toFixed(1)}h timer · {selectedMember.manualHours.toFixed(1)}h manual
                        </div>
                        <p className="text-xs text-muted-foreground">Logged Time</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {selectedMember.tasksCompleted + selectedMember.tasksInProgress + selectedMember.tasksToDo > 0
                            ? (
                                (selectedMember.tasksCompleted /
                                  (selectedMember.tasksCompleted +
                                    selectedMember.tasksInProgress +
                                    selectedMember.tasksToDo)) *
                                100
                              ).toFixed(0)
                            : 0}
                          %
                        </div>
                        <p className="text-xs text-muted-foreground">Task Success Rate</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Task Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Completed</span>
                          <span className="font-medium">{selectedMember.tasksCompleted}</span>
                        </div>
                        <Progress
                          value={
                            selectedMember.tasksCompleted + selectedMember.tasksInProgress + selectedMember.tasksToDo > 0
                              ? (selectedMember.tasksCompleted /
                                  (selectedMember.tasksCompleted +
                                    selectedMember.tasksInProgress +
                                    selectedMember.tasksToDo)) *
                                100
                              : 0
                          }
                          className="bg-green-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>In Progress</span>
                          <span className="font-medium">{selectedMember.tasksInProgress}</span>
                        </div>
                        <Progress
                          value={
                            selectedMember.tasksCompleted + selectedMember.tasksInProgress + selectedMember.tasksToDo > 0
                              ? (selectedMember.tasksInProgress /
                                  (selectedMember.tasksCompleted +
                                    selectedMember.tasksInProgress +
                                    selectedMember.tasksToDo)) *
                                100
                              : 0
                          }
                          className="bg-yellow-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>To Do</span>
                          <span className="font-medium">{selectedMember.tasksToDo}</span>
                        </div>
                        <Progress
                          value={
                            selectedMember.tasksCompleted + selectedMember.tasksInProgress + selectedMember.tasksToDo > 0
                              ? (selectedMember.tasksToDo /
                                  (selectedMember.tasksCompleted +
                                    selectedMember.tasksInProgress +
                                    selectedMember.tasksToDo)) *
                                100
                              : 0
                          }
                          className="bg-gray-100"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Activity</CardTitle>
                      <CardDescription>Last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <Activity className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="text-2xl font-bold">{selectedMember.recentActivity}</div>
                          <p className="text-sm text-muted-foreground">Comments & Updates</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Member Since</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(selectedMember.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Teams;
