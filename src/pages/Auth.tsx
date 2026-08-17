import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { friendlyErrorMessage } from '@/lib/errors';
import { Loader2, ArrowLeft, MailCheck, ShieldCheck } from 'lucide-react';

type View = 'auth' | 'forgot' | 'otp';

const Auth = () => {
  const { user, signIn, signUp, loading, resetPassword, verifyOtp, resendOtp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>('auth');
  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({ email: '', password: '', fullName: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInData.email || !signInData.password) return;

    setIsLoading(true);
    const { error } = await signIn(signInData.email, signInData.password);

    if (error) {
      if (error.message?.toLowerCase().includes('not confirmed')) {
        setOtpEmail(signInData.email);
        setView('otp');
        toast({
          title: 'Email not verified',
          description: 'Enter the 6-digit code we emailed you.',
        });
      } else {
        toast({
          title: 'Error signing in',
          description: friendlyErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpData.email || !signUpData.password || !signUpData.fullName) return;

    setIsLoading(true);
    const { error } = await signUp(signUpData.email, signUpData.password, signUpData.fullName);

    if (error) {
      toast({
        title: 'Error signing up',
        description: friendlyErrorMessage(error),
        variant: 'destructive',
      });
    } else {
      setOtpEmail(signUpData.email);
      setOtp('');
      setView('otp');
      toast({
        title: 'Verify your email',
        description: 'We sent a 6-digit verification code to your inbox.',
      });
    }
    setIsLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsLoading(true);
    const { error } = await resetPassword(forgotEmail);
    if (error) {
      toast({ title: 'Could not send reset email', description: friendlyErrorMessage(error), variant: 'destructive' });
    } else {
      setForgotSent(true);
      toast({ title: 'Reset link sent', description: 'Check your inbox to set a new password.' });
    }
    setIsLoading(false);
  };

  const handleVerify = async (code?: string) => {
    const token = code ?? otp;
    if (token.length !== 6) return;
    setIsLoading(true);
    const { error } = await verifyOtp(otpEmail, token, 'signup');
    if (error) {
      toast({ title: 'Verification failed', description: friendlyErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: 'Email verified', description: 'Welcome to Kaam!' });
    }
    setIsLoading(false);
  };

  const handleResend = async () => {
    setIsLoading(true);
    const { error } = await resendOtp(otpEmail, 'signup');
    toast(
      error
        ? { title: 'Could not resend code', description: friendlyErrorMessage(error), variant: 'destructive' }
        : { title: 'Code resent', description: `A new code is on its way to ${otpEmail}.` }
    );
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
          <CardTitle className="text-3xl">
            {view === 'forgot' ? 'Reset your password' : view === 'otp' ? 'Verify your email' : 'Welcome to Kaam'}
          </CardTitle>
          <CardDescription>
            {view === 'forgot'
              ? "We'll email you a secure link to choose a new password"
              : view === 'otp'
              ? `Enter the 6-digit code sent to ${otpEmail}`
              : 'Your complete project management workspace'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {view === 'auth' && (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() => {
                          setForgotEmail(signInData.email);
                          setForgotSent(false);
                          setView('forgot');
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={signUpData.fullName}
                      onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email</Label>
                    <Input
                      id="signupEmail"
                      type="email"
                      placeholder="Enter your email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Password</Label>
                    <Input
                      id="signupPassword"
                      type="password"
                      placeholder="Create a password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign Up'}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    We'll send a 6-digit code to verify your email.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {view === 'forgot' && (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="space-y-3 rounded-lg border border-chart-2/30 bg-chart-2/10 p-4 text-center">
                  <MailCheck className="mx-auto h-8 w-8 text-chart-2" />
                  <p className="text-sm">
                    A password reset link is on its way to <strong>{forgotEmail}</strong>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgotEmail">Email</Label>
                    <Input
                      id="forgotEmail"
                      type="email"
                      placeholder="Enter your account email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                  </Button>
                </form>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setView('auth')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Button>
            </div>
          )}

          {view === 'otp' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    if (value.length === 6) handleVerify(value);
                  }}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                className="w-full"
                disabled={isLoading || otp.length !== 6}
                onClick={() => handleVerify()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verify code
                  </>
                )}
              </Button>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setView('auth')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button variant="link" size="sm" onClick={handleResend} disabled={isLoading}>
                  Resend code
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
