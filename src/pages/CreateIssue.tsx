import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar as CalendarIcon, X } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { projectPath, cn } from '@/lib/utils';
import { format } from 'date-fns';

const issueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  issueType: z.enum(['promotional_post', 'event_post', 'festive_post', 'reels', 'content_creation', 'ads_campaign', 'calendar_content', 'profile_image', 'cover_image', 'logo_design', 'website_development', 'app_development', 'ui_ux_design', 'backend', 'frontend', 'client_meeting', 'team_meeting', 'task', 'bug', 'other']),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']),
  status: z.enum(['to_do', 'in_progress', 'review', 'done']),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.date().optional(),
  estimatedHours: z.number().min(0).optional(),
  labels: z.array(z.string()).optional(),
  calendarEntryLink: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

const CreateIssue = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [newLabel, setNewLabel] = useState('');

  const form = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      title: '',
      description: '',
      issueType: 'task',
      priority: 'medium',
      status: (searchParams.get('status') as any) || 'to_do',
      assigneeIds: [],
      labels: [],
      calendarEntryLink: '',
    },
  });

  const watchedLabels = form.watch('labels') || [];
  const watchedAssignees = form.watch('assigneeIds') || [];

  useEffect(() => {
    fetchProfiles();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
    } else if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projectId, projects]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, key')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const addLabel = () => {
    if (newLabel.trim() && !watchedLabels.includes(newLabel.trim())) {
      form.setValue('labels', [...watchedLabels, newLabel.trim()]);
      setNewLabel('');
    }
  };

  const removeLabel = (labelToRemove: string) => {
    form.setValue('labels', watchedLabels.filter(label => label !== labelToRemove));
  };

  const toggleAssignee = (userId: string) => {
    const currentAssignees = watchedAssignees;
    if (currentAssignees.includes(userId)) {
      form.setValue('assigneeIds', currentAssignees.filter(id => id !== userId));
    } else {
      form.setValue('assigneeIds', [...currentAssignees, userId]);
    }
  };

  const onSubmit = async (values: z.infer<typeof issueSchema>) => {
    if (!selectedProjectId) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      // First create the issue
      const { data: issue, error } = await supabase
        .from('issues')
        .insert({
          title: values.title,
          description: values.description,
          issue_type: values.issueType,
          priority: values.priority,
          status: values.status,
          assignee_id: values.assigneeIds && values.assigneeIds.length > 0 ? values.assigneeIds[0] : null,
          reporter_id: user?.id,
          project_id: selectedProjectId,
          due_date: values.dueDate?.toISOString(),
          estimated_hours: values.estimatedHours,
          labels: values.labels,
          calendar_entry_link: values.calendarEntryLink || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add multiple assignees to issue_assignees table
      if (values.assigneeIds && values.assigneeIds.length > 0 && issue) {
        const assigneeRecords = values.assigneeIds.map(userId => ({
          issue_id: issue.id,
          user_id: userId,
        }));

        const { error: assigneeError } = await supabase
          .from('issue_assignees')
          .insert(assigneeRecords);

        if (assigneeError) throw assigneeError;

        // Notify each assignee (except yourself)
        const recipients = values.assigneeIds.filter((uid) => uid !== user?.id);
        if (recipients.length > 0) {
          await supabase.from('notifications').insert(
            recipients.map((uid) => ({
              user_id: uid,
              type: 'task_assigned',
              title: 'New task assigned to you',
              message: `You were assigned to "${values.title}".`,
              link: `/app/issues/${issue.id}`,
              metadata: { issue_id: issue.id },
            })),
          );
        }
      }


      toast({
        title: "Issue Created",
        description: `Issue "${values.title}" has been created successfully.`,
      });

      navigate(projectPath(selectedProjectId, projects.find((p) => p.id === selectedProjectId)?.name));
    } catch (error: any) {
      toast({
        title: "Error",
        description: friendlyErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={selectedProjectId ? projectPath(selectedProjectId, projects.find((p) => p.id === selectedProjectId)?.name) : '/app/projects'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {selectedProjectId ? 'Back to Project' : 'Back to Projects'}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Issue</CardTitle>
          <CardDescription>
            Create a new task, bug, story, or epic for your project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {!projectId && (
                <div className="mb-6">
                  <Label>Project</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} ({project.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter issue title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the issue in detail" 
                            {...field}
                            rows={6}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="issueType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issue Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select issue type" />
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
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
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
                </div>

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
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
                    control={form.control}
                    name="assigneeIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignees (Multi-select)</FormLabel>
                        <div className="border rounded-lg p-4 space-y-2">
                          {profiles.map((profile) => (
                            <div key={profile.user_id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`assignee-${profile.user_id}`}
                                checked={watchedAssignees.includes(profile.user_id)}
                                onChange={() => toggleAssignee(profile.user_id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <label
                                htmlFor={`assignee-${profile.user_id}`}
                                className="text-sm cursor-pointer"
                              >
                                {profile.full_name || profile.email}
                              </label>
                            </div>
                          ))}
                          {profiles.length === 0 && (
                            <p className="text-sm text-muted-foreground">No users available</p>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
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
                    control={form.control}
                    name="estimatedHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Hours</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.5"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Labels</label>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Add label"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLabel();
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={addLabel}>
                        Add
                      </Button>
                    </div>
                    {watchedLabels.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {watchedLabels.map((label) => (
                          <Badge key={label} variant="secondary" className="flex items-center space-x-1">
                            <span>{label}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0"
                              onClick={() => removeLabel(label)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="calendarEntryLink"
                    render={({ field }) => (
                      <FormItem>
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
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" asChild>
                  <Link to={selectedProjectId ? projectPath(selectedProjectId, projects.find((p) => p.id === selectedProjectId)?.name) : '/app/projects'}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={loading || !selectedProjectId}>
                  {loading ? 'Creating...' : 'Create Issue'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateIssue;