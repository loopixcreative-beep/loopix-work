import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const WorkspaceSetup = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { createWorkspace, joinWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    const { error } = await createWorkspace(name.trim());
    if (error) {
      toast({ title: 'Could not create workspace', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Workspace created', description: `Welcome to ${name.trim()}!` });
      navigate('/app', { replace: true });
    }
    setIsLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsLoading(true);
    const { error } = await joinWorkspace(code.trim());
    if (error) {
      toast({ title: 'Could not join workspace', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Joined workspace', description: 'You\'re in!' });
      navigate('/app', { replace: true });
    }
    setIsLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-orange/20 blur-3xl" />

      <Card className="w-full max-w-md animate-fade-in shadow-stat">
        <CardHeader className="text-center">
          <img
            src="https://res.cloudinary.com/dkk7zqgnz/image/upload/v1785424794/Loopix_final_ibeklc.png"
            alt="Loopix Kaam logo"
            className="mx-auto mb-4 h-16 w-16 object-contain"
          />
          <CardTitle className="text-3xl">One more step</CardTitle>
          <CardDescription>Create a new workspace, or join one with a code from a teammate</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create workspace</TabsTrigger>
              <TabsTrigger value="join">Join workspace</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspaceName">Workspace name</Label>
                  <Input
                    id="workspaceName"
                    placeholder="e.g. Acme Agency"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  You'll get a unique 6-character workspace code to share with your team, and become the workspace's
                  superadmin.
                </p>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create workspace'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="join">
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspaceCode">Workspace code</Label>
                  <Input
                    id="workspaceCode"
                    placeholder="e.g. 87DK91"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-center font-mono text-lg tracking-[0.3em]"
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Ask your workspace's superadmin or an admin for this 6-character code.
                </p>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join workspace'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Had a workspace that was deleted?{' '}
            <Link to="/recover-workspace" className="font-medium text-primary hover:underline">
              Request recovery
            </Link>
          </p>

          <Button variant="ghost" className="mt-2 w-full" onClick={() => signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceSetup;
