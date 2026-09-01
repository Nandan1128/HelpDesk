import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bot,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Shield,
  Headphones,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { signIn } from '../lib/auth-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null);

    try {
      const response = await signIn.email({
        email: values.email.trim(),
        password: values.password,
      });

      if (response.error) {
        setErrorMessage(
          response.error.message || 'Invalid email or password. Please check your credentials.'
        );
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'An unexpected error occurred while connecting to the server.'
      );
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setValue('email', demoEmail, { shouldValidate: true, shouldDirty: true });
    setValue('password', demoPass, { shouldValidate: true, shouldDirty: true });
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation / Brand */}
      <header className="px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Bot className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">TicketAI</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                <Sparkles className="w-3 h-3 mr-1 text-primary" />
                AI Support
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground block -mt-0.5">Support Workspace</span>
          </div>
        </div>
      </header>

      {/* Main Login Form Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <Card className="w-full max-w-md border-border shadow-2xl backdrop-blur-sm bg-card/90">
          <CardHeader className="text-center space-y-1.5">
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to manage support tickets and AI triage workflows
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Server Error Alert */}
            {errorMessage && (
              <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <AlertDescription className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Mail className="w-4 h-4" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="agent@ticketai.local"
                    autoComplete="email"
                    className={`pl-9 ${
                      errors.email
                        ? '!border-red-500 !ring-red-500/20 focus-visible:!border-red-500 focus-visible:!ring-red-500/30'
                        : ''
                    }`}
                    aria-invalid={!!errors.email}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errors.email.message}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`pl-9 pr-10 ${
                      errors.password
                        ? '!border-red-500 !ring-red-500/20 focus-visible:!border-red-500 focus-visible:!ring-red-500/30'
                        : ''
                    }`}
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errors.password.message}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="w-full mt-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Quick Demo Credentials (Development Only) */}
            {import.meta.env.DEV && (
              <>
                <div className="relative py-2">
                  <Separator />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-card px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Quick Demo Accounts (Dev Only)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fillDemoAccount('admin@example.com', 'Password@123')}
                    className="h-auto py-2.5 px-3 flex items-center justify-start text-left gap-2.5 border-border hover:bg-accent/50 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">
                        <span>Admin</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Full</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">admin@example.com</div>
                    </div>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fillDemoAccount('agent1@example.com', 'Password@123')}
                    className="h-auto py-2.5 px-3 flex items-center justify-start text-left gap-2.5 border-border hover:bg-accent/50 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">
                        <span>Agent</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Queue</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">agent1@example.com</div>
                    </div>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fillDemoAccount('admin@ticketai.local', 'AdminPassword123!')}
                    className="h-auto py-2.5 px-3 flex items-center justify-start text-left gap-2.5 border-border hover:bg-accent/50 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">
                        <span>Admin (Local)</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Full</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">admin@ticketai.local</div>
                    </div>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fillDemoAccount('sarah.agent@ticketai.local', 'AgentPassword123!')}
                    className="h-auto py-2.5 px-3 flex items-center justify-start text-left gap-2.5 border-border hover:bg-accent/50 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">
                        <span>Agent (Local)</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Queue</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">sarah.agent@...</div>
                    </div>
                  </Button>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="justify-center border-t py-4 text-center text-xs text-muted-foreground">
            TicketAI &bull; Protected Support Portal
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-center text-xs text-muted-foreground relative z-10">
        Enterprise AI Ticket Management System
      </footer>
    </div>
  );
}

export default LoginPage;

