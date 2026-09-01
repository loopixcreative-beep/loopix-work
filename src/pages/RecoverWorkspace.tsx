import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { Loader2, MailCheck } from 'lucide-react';

const RecoverWorkspace = () => {
  const { user, loading: authLoading } = useAuth();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !code.trim() || !reason.trim()) return;
    setIsLoading(true);
    const { error } = await supabase.from('workspace_recovery_requests').insert({
      requested_by: user.id,
      requester_email: user.email,
      workspace_code: code.trim().toUpperCase(),
      reason: reason.trim(),
    });
    if (error) {
      toast({ title: 'Could not submit request', description: friendlyErrorMessage(error), variant: 'destructive' });
    } else {
      setSubmitted(true);
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
          <CardTitle className="text-2xl">Recover a deleted workspace</CardTitle>
          <CardDescription>
            Requests are reviewed by the Loopix Creations team, not processed automatically
          </CardDescription>
        </CardHeader>

        <CardContent>
          {authLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !user ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in with your account first — we verify who you are through your session, never by asking for a
                password here.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          ) : submitted ? (
            <div className="space-y-3 rounded-lg border border-chart-2/30 bg-chart-2/10 p-4 text-center">
              <MailCheck className="mx-auto h-8 w-8 text-chart-2" />
              <p className="text-sm">
                Your request has been sent for review. You'll be able to see the decision and any reply here once
                it's reviewed.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Signed in as <strong>{user.email}</strong>
              </p>
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
              <div className="space-y-2">
                <Label htmlFor="reason">Why should this workspace be restored?</Label>
                <Textarea
                  id="reason"
                  placeholder="Tell us what happened and why you need it back..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit request'}
              </Button>
            </form>
          )}

          <Button variant="ghost" className="mt-4 w-full" asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecoverWorkspace;
