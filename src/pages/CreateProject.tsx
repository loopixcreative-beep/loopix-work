import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  key: z.string().min(2, 'Project key must be at least 2 characters').max(10).regex(/^[A-Z][A-Z0-9]*$/, 'Project key must start with a letter and contain only uppercase letters and numbers'),
  description: z.string().optional(),
  type: z.enum([
    'digital_marketing',
    'website_development',
    'mobile_app_development',
    'ui_ux_design',
    'graphics_design',
    'video_production',
    'branding_creative',
    'it_software_integration'
  ]),
  leadId: z.string().min(1, 'Project lead is required'),
});

const projectTypeLabels: Record<string, string> = {
  digital_marketing: 'Digital Marketing Project',
  website_development: 'Website Development Project',
  mobile_app_development: 'Mobile App Development Project',
  ui_ux_design: 'UI/UX Design Project',
  graphics_design: 'Graphics Design Project',
  video_production: 'Video Production / Editing Project',
  branding_creative: 'Branding / Creative Strategy Project',
  it_software_integration: 'IT / Software Integration Project',
};

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const CreateProject = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      key: '',
      description: '',
      type: 'website_development',
      leadId: user?.id || '',
    },
  });

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, role')
      .neq('user_id', user?.id);
    
    if (!error && data) {
      setAvailableUsers(data.map(profile => ({
        id: profile.user_id,
        full_name: profile.full_name || profile.email,
        email: profile.email,
        role: profile.role
      })));
    }
  };

  const addTeamMember = (member: TeamMember) => {
    if (!teamMembers.find(m => m.id === member.id)) {
      setTeamMembers([...teamMembers, member]);
    }
  };

  const removeTeamMember = (memberId: string) => {
    setTeamMembers(teamMembers.filter(m => m.id !== memberId));
  };

  const sendInvitation = async () => {
    if (!inviteEmail) return;
    
    // Here you would implement the invitation logic
    // For now, we'll just show a success message
    toast({
      title: "Invitation Sent",
      description: `Invitation sent to ${inviteEmail}`,
    });
    
    setInviteEmail('');
    setShowInviteDialog(false);
  };

  const onSubmit = async (values: z.infer<typeof projectSchema>) => {
    setLoading(true);
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: values.name,
          key: values.key,
          description: values.description,
          type: values.type,
          lead_id: values.leadId,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Project Created",
        description: `Project "${values.name}" has been created successfully.`,
      });

      navigate(`/projects/${project.id}`);
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
          <Link to="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Create New Project</CardTitle>
              <CardDescription>
                Set up your project with the right template and team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter project name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Key</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="PROJ" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="digital_marketing">Digital Marketing Project</SelectItem>
                            <SelectItem value="website_development">Website Development Project</SelectItem>
                            <SelectItem value="mobile_app_development">Mobile App Development Project</SelectItem>
                            <SelectItem value="ui_ux_design">UI/UX Design Project</SelectItem>
                            <SelectItem value="graphics_design">Graphics Design Project</SelectItem>
                            <SelectItem value="video_production">Video Production / Editing Project</SelectItem>
                            <SelectItem value="branding_creative">Branding / Creative Strategy Project</SelectItem>
                            <SelectItem value="it_software_integration">IT / Software Integration Project</SelectItem>
                          </SelectContent>
                        </Select>
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
                            placeholder="Describe your project" 
                            {...field}
                            rows={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Creating...' : 'Create Project'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Team Members</CardTitle>
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={fetchUsers}>
                      <Plus className="mr-2 h-4 w-4" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Members</DialogTitle>
                      <DialogDescription>
                        Add existing users or send invitations to new team members
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Existing Users</h4>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {availableUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-2 border rounded">
                              <div>
                                <p className="text-sm font-medium">{user.full_name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => addTeamMember(user)}
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Send Invitation</h4>
                        <div className="flex space-x-2">
                          <Input
                            placeholder="Enter email address"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            type="email"
                          />
                          <Button onClick={sendInvitation}>Send</Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamMembers.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No team members added yet</p>
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {member.role}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTeamMember(member.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateProject;