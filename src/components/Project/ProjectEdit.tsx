import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProjectEditProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    objectives: string | null;
    goals: string | null;
  };
  onUpdate: () => void;
}

export const ProjectEdit = ({ project, onUpdate }: ProjectEditProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || '',
    objectives: project.objectives || '',
    goals: project.goals || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: formData.name,
          description: formData.description,
          objectives: formData.objectives,
          goals: formData.goals,
        })
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: 'Project updated',
        description: 'Project details have been updated successfully.',
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Project Details</CardTitle>
        <CardDescription>Update your project information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectives">Project Objectives</Label>
            <Textarea
              id="objectives"
              value={formData.objectives}
              onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
              placeholder="Define what you want to achieve..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goals">Project Goals</Label>
            <Textarea
              id="goals"
              value={formData.goals}
              onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
              placeholder="Set specific, measurable goals..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};