import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CommentWithMedia } from '@/components/Issue/CommentWithMedia';
import { ApprovalWorkflow } from '@/components/Approval/ApprovalWorkflow';
import { ArrowLeft, Edit, Calendar as CalendarIcon, User, Clock, AlertCircle, MessageSquare, Send, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AssigneesList } from '@/components/Issue/AssigneesList';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { DeleteIssueDialog } from '@/components/Issue/DeleteIssueDialog';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Linkify } from '@/components/ui/linkify';


const commentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(1000),
});

const issueUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  issueType: z.enum(['promotional_post', 'event_post', 'festive_post', 'reels', 'content_creation', 'ads_campaign', 'calendar_content', 'profile_image', 'cover_image', 'logo_design', 'website_development', 'app_development', 'ui_ux_design', 'backend', 'frontend', 'client_meeting', 'team_meeting', 'task', 'bug', 'other']),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']),
  status: z.enum(['to_do', 'in_progress', 'review', 'done']),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.date().optional(),
  estimatedHours: z.number().min(0).optional(),
  calendarEntryLink: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});


interface Issue {
  id: string;
  issue_key: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  issue_type: string;
  assignee_id: string | null;
  reporter_id: string;
  due_date: string | null;
  estimated_hours: number | null;
  logged_hours: number;
  created_at: string;
  updated_at: string;
  calendar_entry_link: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  assignee: {
    full_name: string;
    email: string;
  } | null;
  reporter: {
    full_name: string;
    email: string;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: {
    full_name: string;
    email: string;
  };
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

const IssueDetail = () => {
  const { projectId, issueId } = useParams();
  const { user } = useAuth();
  const { canManageAll } = useUserRoles();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentAssigneeIds, setCurrentAssigneeIds] = useState<string[]>([]);
  const [assigneeRefresh, setAssigneeRefresh] = useState(0);


  const commentForm = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      content: '',
    },
  });

  const updateForm = useForm<z.infer<typeof issueUpdateSchema>>({
    resolver: zodResolver(issueUpdateSchema),
    defaultValues: {
      title: '',
      description: '',
      issueType: 'task',
      priority: 'medium',
      status: 'to_do',
      assigneeIds: [],
    },
  });

  useEffect(() => {
    if (issueId) {
      fetchIssue();
      fetchComments();
      fetchProfiles();
      fetchCurrentAssignees();
    }
  }, [issueId]);

  useEffect(() => {
    if (issue) {
      updateForm.reset({
        title: issue.title,
        description: issue.description || '',
        issueType: issue.issue_type as any,
        priority: issue.priority as any,
        status: issue.status as any,
        assigneeIds: currentAssigneeIds,
        dueDate: issue.due_date ? new Date(issue.due_date) : undefined,
        estimatedHours: issue.estimated_hours || undefined,
        calendarEntryLink: issue.calendar_entry_link || '',
      });
    }
  }, [issue, currentAssigneeIds, updateForm]);

  const fetchCurrentAssignees = async () => {
    const { data } = await supabase
      .from('issue_assignees')
      .select('user_id')
      .eq('issue_id', issueId);
    setCurrentAssigneeIds((data || []).map((a) => a.user_id));
  };


  const fetchIssue = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          assignee:profiles!issues_assignee_id_fkey(full_name, email, avatar_url),
          reporter:profiles!issues_reporter_id_fkey(full_name, email, avatar_url)
        `)
        .eq('id', issueId)
        .single();

      if (error) throw error;
      setIssue(data);
    } catch (error) {
      console.error('Error fetching issue:', error);
      toast({
        title: "Error",
        description: "Failed to load issue details",
        variant: "destructive",
      });
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!comments_author_id_fkey(full_name, email, avatar_url)
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const addComment = async (values: z.infer<typeof commentSchema>) => {
    if (!user || !issueId) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          content: values.content,
          issue_id: issueId,
          author_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully.",
      });

      commentForm.reset();
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateIssue = async (values: z.infer<typeof issueUpdateSchema>) => {
    if (!issueId) return;

    const assigneeIds = values.assigneeIds || [];

    try {
      const { error } = await supabase
        .from('issues')
        .update({
          title: values.title,
          description: values.description,
          issue_type: values.issueType,
          priority: values.priority,
          status: values.status,
          assignee_id: assigneeIds.length > 0 ? assigneeIds[0] : null,
          due_date: values.dueDate?.toISOString(),
          estimated_hours: values.estimatedHours,
          calendar_entry_link: values.calendarEntryLink || null,
        })
        .eq('id', issueId);

      if (error) throw error;

      // Sync the multi-assignee table
      const { error: delError } = await supabase
        .from('issue_assignees')
        .delete()
        .eq('issue_id', issueId);
      if (delError) throw delError;

      if (assigneeIds.length > 0) {
        const { error: insError } = await supabase
          .from('issue_assignees')
          .insert(assigneeIds.map((uid) => ({ issue_id: issueId, user_id: uid })));
        if (insError) throw insError;
      }

      // Notify newly added assignees
      const newlyAssigned = assigneeIds.filter(
        (uid) => !currentAssigneeIds.includes(uid) && uid !== user?.id,
      );
      if (newlyAssigned.length > 0) {
        await supabase.from('notifications').insert(
          newlyAssigned.map((uid) => ({
            user_id: uid,
            type: 'task_assigned',
            title: 'New task assigned to you',
            message: `You were assigned to "${values.title}".`,
            link: `/issues/${issueId}`,
            metadata: { issue_id: issueId },
          })),
        );
      }


      toast({
        title: "Issue Updated",
        description: "The issue has been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setCurrentAssigneeIds(assigneeIds);
      setAssigneeRefresh((n) => n + 1);
      fetchIssue();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Any signed-in team member can edit or delete tasks
  const canEditIssue = () => !!issue && !!user;


  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'highest':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'lowest':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'done':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'story':
        return <User className="h-5 w-5 text-green-500" />;
      case 'task':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'epic':
        return <User className="h-5 w-5 text-purple-500" />;
      default:
        return <User className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading || !issue) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-8 bg-muted rounded w-1/4"></div>
        <Card>
          <CardHeader>
            <div className="animate-pulse h-6 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Project
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
        {canEditIssue() && (

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Issue
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Issue</DialogTitle>
              </DialogHeader>
              <Form {...updateForm}>
                <form onSubmit={updateForm.handleSubmit(updateIssue)} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={updateForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={updateForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={4} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={updateForm.control}
                      name="issueType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="promotional_post">Promotional Post</SelectItem>
                              <SelectItem value="event_post">Event Post</SelectItem>
                              <SelectItem value="festive_post">Festive Post</SelectItem>
                              <SelectItem value="reels">Reels</SelectItem>
                              <SelectItem value="content_creation">Content Creation</SelectItem>
                              <SelectItem value="ads_campaign">Ads Campaign</SelectItem>
                              <SelectItem value="calendar_content">Calendar Content</SelectItem>
                              <SelectItem value="profile_image">Profile Image</SelectItem>
                              <SelectItem value="cover_image">Cover Image</SelectItem>
                              <SelectItem value="logo_design">Logo Design</SelectItem>
                              <SelectItem value="website_development">Website Development</SelectItem>
                              <SelectItem value="app_development">App Development</SelectItem>
                              <SelectItem value="ui_ux_design">UI/UX Design</SelectItem>
                              <SelectItem value="backend">Backend</SelectItem>
                              <SelectItem value="frontend">Frontend</SelectItem>
                              <SelectItem value="client_meeting">Client Meeting</SelectItem>
                              <SelectItem value="team_meeting">Team Meeting</SelectItem>
                              <SelectItem value="task">Task</SelectItem>

                              <SelectItem value="bug">Bug</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={updateForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="lowest">Lowest</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="highest">Highest</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={updateForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="to_do">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={updateForm.control}
                      name="assigneeIds"
                      render={({ field }) => {
                        const selected = field.value || [];
                        const toggle = (uid: string) =>
                          field.onChange(
                            selected.includes(uid)
                              ? selected.filter((id) => id !== uid)
                              : [...selected, uid]
                          );
                        return (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Assignees (select one or more)</FormLabel>
                            <div className="border rounded-lg p-3 max-h-56 overflow-y-auto space-y-2">
                              {profiles.map((profile) => (
                                <label
                                  key={profile.user_id}
                                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 hover:bg-muted"
                                >
                                  <Checkbox
                                    checked={selected.includes(profile.user_id)}
                                    onCheckedChange={() => toggle(profile.user_id)}
                                  />
                                  <UserAvatar
                                    size="xs"
                                    name={profile.full_name}
                                    email={profile.email}
                                    avatarUrl={(profile as any).avatar_url}
                                  />
                                  <span className="text-sm">
                                    {profile.full_name || profile.email}
                                  </span>
                                </label>
                              ))}
                              {profiles.length === 0 && (
                                <p className="text-sm text-muted-foreground">No users available</p>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />


                    <FormField
                      control={updateForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Due Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={updateForm.control}
                      name="estimatedHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Hours</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              step="0.5"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={updateForm.control}
                      name="calendarEntryLink"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Calendar Entry Link</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Paste calendar entry link (optional)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Update Issue</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
        {!!user && (
          <DeleteIssueDialog
            issueId={issue.id}
            issueKey={issue.issue_key}
            issueTitle={issue.title}
            projectId={projectId || ''}
            onDeleted={() => navigate(`/projects/${projectId}`)}
          />
        )}
        </div>
      </div>


      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                {getTypeIcon(issue.issue_type)}
                <h1 className="text-2xl font-bold">{issue.title}</h1>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className="font-mono font-medium">{issue.issue_key}</span>
                <span>•</span>
                <span>Created {format(new Date(issue.created_at), 'MMM dd, yyyy')}</span>
                <span>•</span>
                <span>Updated {format(new Date(issue.updated_at), 'MMM dd, yyyy')}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={`${getStatusColor(issue.status)} text-xs`}>
                {issue.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge className={`${getPriorityColor(issue.priority)} text-xs`}>
                {issue.priority.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {issue.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                <Linkify text={issue.description} />
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Assignees</h3>
                <AssigneesList issueId={issue.id} refreshKey={assigneeRefresh} />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Reporter</h3>
                <div className="flex items-center space-x-2">
                  <UserAvatar
                    name={issue.reporter.full_name}
                    email={issue.reporter.email}
                    avatarUrl={(issue.reporter as any).avatar_url}
                  />
                  <span>{issue.reporter.full_name || issue.reporter.email}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Due Date</h3>
                {issue.due_date ? (
                  <span>{format(new Date(issue.due_date), 'PPP')}</span>
                ) : (
                  <span className="text-muted-foreground">No due date set</span>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Time Tracking</h3>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Estimated:</span>
                    <span>{issue.estimated_hours ? `${issue.estimated_hours}h` : 'Not set'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Logged:</span>
                    <span>{issue.logged_hours}h</span>
                  </div>
                </div>
              </div>

              {issue.calendar_entry_link && (
                <div>
                  <h3 className="font-semibold mb-2">Calendar Entry</h3>
                  <a 
                    href={issue.calendar_entry_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    View Entry Details
                  </a>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ApprovalWorkflow
        issueId={issue.id}
        currentStatus={issue.approval_status}
        approvedBy={issue.approved_by}
        approvedAt={issue.approved_at}
        approvalNotes={issue.approval_notes}
        reporterId={issue.reporter_id}
        onStatusChange={fetchIssue}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Comments</span>
            <Badge variant="secondary">{comments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CommentWithMedia 
            issueId={issue.id} 
            comments={comments as any} 
            onRefresh={fetchComments} 
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default IssueDetail;