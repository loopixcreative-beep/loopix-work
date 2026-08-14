import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Calendar as CalendarIcon, Play, Square, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const sprintSchema = z.object({
  name: z.string().min(1, 'Sprint name is required'),
  goal: z.string().optional(),
  startDate: z.date({
    message: 'Start date is required',
  }),
  endDate: z.date({
    message: 'End date is required',
  }),
});

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface SprintManagementProps {
  projectId: string;
}

const SprintManagement = ({ projectId }: SprintManagementProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const form = useForm<z.infer<typeof sprintSchema>>({
    resolver: zodResolver(sprintSchema),
    defaultValues: {
      name: '',
      goal: '',
    },
  });

  useEffect(() => {
    fetchSprints();
  }, [projectId]);

  const fetchSprints = async () => {
    try {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSprints(data || []);
    } catch (error) {
      console.error('Error fetching sprints:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof sprintSchema>) => {
    try {
      const { data, error } = await supabase
        .from('sprints')
        .insert({
          name: values.name,
          goal: values.goal,
          start_date: values.startDate.toISOString(),
          end_date: values.endDate.toISOString(),
          project_id: projectId,
          is_active: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sprint Created",
        description: `Sprint "${values.name}" has been created successfully.`,
      });

      setSprints([data, ...sprints]);
      setShowCreateDialog(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startSprint = async (sprintId: string) => {
    try {
      // First, deactivate any active sprints
      await supabase
        .from('sprints')
        .update({ is_active: false })
        .eq('project_id', projectId);

      // Then activate the selected sprint
      const { error } = await supabase
        .from('sprints')
        .update({ is_active: true })
        .eq('id', sprintId);

      if (error) throw error;

      toast({
        title: "Sprint Started",
        description: "Sprint has been activated successfully.",
      });

      fetchSprints();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const completeSprint = async (sprintId: string) => {
    try {
      const { error } = await supabase
        .from('sprints')
        .update({ is_active: false })
        .eq('id', sprintId);

      if (error) throw error;

      toast({
        title: "Sprint Completed",
        description: "Sprint has been completed successfully.",
      });

      fetchSprints();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSprintStatus = (sprint: Sprint) => {
    const now = new Date();
    const startDate = new Date(sprint.start_date);
    const endDate = new Date(sprint.end_date);

    if (sprint.is_active) {
      return { status: 'active', label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
    } else if (now < startDate) {
      return { status: 'future', label: 'Future', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' };
    } else if (now > endDate) {
      return { status: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' };
    } else {
      return { status: 'ready', label: 'Ready', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' };
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse h-6 bg-muted rounded w-1/4"></div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <span>Sprint Management</span>
            <Badge variant="secondary">{sprints.length}</Badge>
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Sprint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Sprint</DialogTitle>
                <DialogDescription>
                  Set up a new sprint for your project
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sprint Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Sprint 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sprint Goal</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What do you want to achieve in this sprint?" 
                            {...field}
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
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
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Date</FormLabel>
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
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create Sprint</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {sprints.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No sprints created yet</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create your first sprint
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sprints.map((sprint) => {
              const status = getSprintStatus(sprint);
              
              return (
                <Card key={sprint.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold">{sprint.name}</h3>
                          <Badge className={status.color}>
                            {status.label}
                          </Badge>
                        </div>
                        
                        {sprint.goal && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {sprint.goal}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                          <span>
                            {format(new Date(sprint.start_date), 'MMM dd, yyyy')} - {format(new Date(sprint.end_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        {status.status === 'ready' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => startSprint(sprint.id)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Start Sprint
                          </Button>
                        )}
                        
                        {status.status === 'active' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => completeSprint(sprint.id)}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Complete Sprint
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SprintManagement;