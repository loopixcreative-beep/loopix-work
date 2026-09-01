import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { RoleManagement } from '@/components/Admin/RoleManagement';
import { WorkspaceSettingsTab } from '@/components/Settings/WorkspaceSettingsTab';
import {
  Settings as SettingsIcon, Bell, Lock, Users, Palette,
  Calendar, Clock, Globe, Download, Trash2, Shield, Building2
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/Theme/ThemeToggle';

const themeOptions = [
  { value: 'light', label: 'Light', description: 'Bright and clean', preview: 'bg-white border-border' },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', preview: 'bg-zinc-900 border-zinc-700' },
  { value: 'system', label: 'System', description: 'Match your device', preview: 'bg-gradient-to-r from-white to-zinc-900 border-border' },
] as const;

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [loading, setLoading] = useState(false);


  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [taskAssignments, setTaskAssignments] = useState(true);
  const [projectUpdates, setProjectUpdates] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Work Preferences
  const [workingHours, setWorkingHours] = useState('9');
  const [defaultDuration, setDefaultDuration] = useState('8');
  const [calendarView, setCalendarView] = useState('month');
  const [startOfWeek, setStartOfWeek] = useState('sunday');

  // Privacy & Security
  const [profileVisibility, setProfileVisibility] = useState('team');
  const [activityTracking, setActivityTracking] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setEmailNotifications(data.email_notifications);
        setTaskAssignments(data.task_assignments);
        setProjectUpdates(data.project_updates);
        setDeadlineReminders(data.deadline_reminders);
        setWeeklyDigest(data.weekly_digest);
        setWorkingHours(data.working_hours.toString());
        setDefaultDuration(data.default_duration.toString());
        setStartOfWeek(data.start_of_week);
        setCalendarView(data.calendar_view);
        setProfileVisibility(data.profile_visibility);
        setActivityTracking(data.activity_tracking);
        setTwoFactorAuth(data.two_factor_auth);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user?.id,
          email_notifications: emailNotifications,
          task_assignments: taskAssignments,
          project_updates: projectUpdates,
          deadline_reminders: deadlineReminders,
          weekly_digest: weeklyDigest,
        });

      if (error) throw error;

      toast({
        title: 'Notifications updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update notification settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkPreferences = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user?.id,
          working_hours: parseInt(workingHours),
          default_duration: parseInt(defaultDuration),
          start_of_week: startOfWeek,
          calendar_view: calendarView,
        });

      if (error) throw error;

      toast({
        title: 'Preferences updated',
        description: 'Your work preferences have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update work preferences.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user?.id,
          profile_visibility: profileVisibility,
          activity_tracking: activityTracking,
          two_factor_auth: twoFactorAuth,
        });

      if (error) throw error;

      toast({
        title: 'Privacy settings updated',
        description: 'Your privacy and security settings have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update privacy settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    toast({
      title: 'Export initiated',
      description: 'Your data export will be sent to your email shortly.',
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: 'Account deletion',
      description: 'Please contact support to delete your account.',
      variant: 'destructive',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="workspace">
            <Building2 className="mr-2 h-4 w-4" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="work">
            <Clock className="mr-2 h-4 w-4" />
            Work Preferences
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="mr-2 h-4 w-4" />
            Privacy & Security
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="roles">
              <Users className="mr-2 h-4 w-4" />
              Role Management
            </TabsTrigger>
          )}
          <TabsTrigger value="advanced">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-6">
          <WorkspaceSettingsTab />
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Choose how Kaam looks on this device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {themeOptions.map(({ value, label, description, preview }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-stat ${
                      theme === value ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <div className={`mb-3 h-20 w-full rounded-lg border ${preview}`}>
                      <div className="flex h-full flex-col justify-between p-2">
                        <div className="h-2 w-10 rounded-full bg-chart-1" />
                        <div className="h-2 w-14 rounded-full bg-chart-2" />
                      </div>
                    </div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </button>
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Quick switch</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle themes instantly — also available in the top bar
                  </p>
                </div>
                <ThemeToggle />
              </div>

              <div className="rounded-xl border bg-gradient-to-br from-chart-1/10 to-chart-2/10 p-4">
                <p className="font-semibold">Brand palette</p>
                <p className="text-sm text-muted-foreground">
                  Kaam uses a blue → orange accent system across charts and stats
                </p>
                <div className="mt-3 flex gap-2">
                  {['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6'].map((c) => (
                    <span key={c} className={`h-8 w-8 rounded-lg ${c}`} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose what notifications you want to receive via email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="task-assignments">Task Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you're assigned a task
                  </p>
                </div>
                <Switch
                  id="task-assignments"
                  checked={taskAssignments}
                  onCheckedChange={setTaskAssignments}
                  disabled={!emailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="project-updates">Project Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about projects you're involved in
                  </p>
                </div>
                <Switch
                  id="project-updates"
                  checked={projectUpdates}
                  onCheckedChange={setProjectUpdates}
                  disabled={!emailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="deadline-reminders">Deadline Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get reminded about upcoming deadlines
                  </p>
                </div>
                <Switch
                  id="deadline-reminders"
                  checked={deadlineReminders}
                  onCheckedChange={setDeadlineReminders}
                  disabled={!emailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekly-digest">Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly summary of your activities
                  </p>
                </div>
                <Switch
                  id="weekly-digest"
                  checked={weeklyDigest}
                  onCheckedChange={setWeeklyDigest}
                  disabled={!emailNotifications}
                />
              </div>

              <Button onClick={handleSaveNotifications} disabled={loading}>
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Work Preferences Tab */}
        <TabsContent value="work" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Working Hours</CardTitle>
              <CardDescription>
                Set your typical working hours and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="working-hours">Working Hours per Day</Label>
                  <Input
                    id="working-hours"
                    type="number"
                    min="1"
                    max="24"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-duration">Default Task Duration (hours)</Label>
                  <Input
                    id="default-duration"
                    type="number"
                    min="1"
                    max="40"
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-of-week">Start of Week</Label>
                <Select value={startOfWeek} onValueChange={setStartOfWeek}>
                  <SelectTrigger id="start-of-week">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calendar-view">Default Calendar View</Label>
                <Select value={calendarView} onValueChange={setCalendarView}>
                  <SelectTrigger id="calendar-view">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveWorkPreferences} disabled={loading}>
                Save Work Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy & Security Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control who can see your information and activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-visibility">Profile Visibility</Label>
                <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                  <SelectTrigger id="profile-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="team">Team Members Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="activity-tracking">Activity Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow tracking of your activity for analytics
                  </p>
                </div>
                <Switch
                  id="activity-tracking"
                  checked={activityTracking}
                  onCheckedChange={setActivityTracking}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  id="two-factor"
                  checked={twoFactorAuth}
                  onCheckedChange={setTwoFactorAuth}
                />
              </div>

              <Button onClick={handleSavePrivacy} disabled={loading}>
                Save Privacy Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Management Tab (Admin Only) */}
        {isAdmin && (
          <TabsContent value="roles" className="space-y-6">
            <RoleManagement />
          </TabsContent>
        )}

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export or delete your account data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Export Your Data</h4>
                <p className="text-sm text-muted-foreground">
                  Download a copy of all your data including projects, tasks, and time logs
                </p>
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="mr-2 h-4 w-4" />
                  Request Data Export
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium text-destructive">Danger Zone</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
                <Button variant="destructive" onClick={handleDeleteAccount}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
