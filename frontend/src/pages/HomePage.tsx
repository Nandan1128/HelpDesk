import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Ticket,
  Database,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  Mail,
  Clock,
  Shield,
  Headphones,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useSession, AuthUser } from '../lib/auth-client';

interface HealthStatus {
  status: string;
  database: string;
  timestamp: string;
  version: string;
}

export function HomePage() {
  const { data: session } = useSession();
  const user = session?.user as AuthUser | undefined;

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<HealthStatus>('/health')
      .then((res) => {
        setHealth(res.data);
        setHealthError(null);
      })
      .catch((err) => {
        setHealthError(err.response?.data?.error || err.message || 'Failed to connect to backend');
      })
      .finally(() => {
        setHealthLoading(false);
      });
  }, []);

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-8">
      {/* Hero Welcome Card */}
      <Card className="border-border bg-card shadow-sm overflow-hidden relative">
        <div className="absolute right-[-20px] top-[-20px] w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <CardContent className="p-6 sm:p-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold text-xs py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Authenticated Session
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Welcome back, {user?.name || 'Agent'}! 👋
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Signed in as <span className="text-foreground font-medium">{user?.email}</span> with{' '}
                <span className={`font-semibold ${isAdmin ? 'text-indigo-500 dark:text-indigo-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                  {isAdmin ? 'Administrator' : 'Support Agent'}
                </span>{' '}
                privileges.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="bg-muted/50 border border-border rounded-2xl p-3.5 flex items-center space-x-3 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  {isAdmin ? <Shield className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
                </div>
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">Current Role</div>
                  <div className="text-sm font-bold text-foreground uppercase">{user?.role || 'AGENT'}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Open Tickets
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">2</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center mt-1 font-medium">
              1 high priority
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resolved
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">1</div>
            <p className="text-xs text-muted-foreground mt-1">Seeded historical ticket</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              AI Summaries
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">Gemini 1.5</div>
            <p className="text-xs text-primary mt-1 font-medium">RAG suggestions active</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Support Agents
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">3 active</div>
            <p className="text-xs text-muted-foreground mt-1">Admin + 2 Agents</p>
          </CardContent>
        </Card>
      </div>

      {/* System Diagnostics & Backend Status */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Live System Diagnostics
          </CardTitle>
          <CardDescription>
            Real-time status of backend API services and database connections
          </CardDescription>
        </CardHeader>

        <CardContent>
          {healthLoading ? (
            <div className="py-4 text-center text-muted-foreground text-sm animate-pulse">
              Querying backend &amp; database health...
            </div>
          ) : healthError ? (
            <div className="flex items-start space-x-3 bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium">Backend Connection Error</p>
                <p className="text-xs mt-1">{healthError}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Backend API</span>
                  <span className="text-sm font-semibold text-foreground mt-0.5">Express (Port 5000)</span>
                </div>
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {health?.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">PostgreSQL Database</span>
                  <span className="text-sm font-semibold text-foreground mt-0.5">Prisma ORM</span>
                </div>
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {health?.database}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Auth Engine</span>
                  <span className="text-sm font-semibold text-foreground mt-0.5">Better Auth</span>
                </div>
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active Session
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Modules Roadmap */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card flex flex-col justify-between">
          <CardHeader>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-semibold">Session Authentication</CardTitle>
            <CardDescription className="text-xs">
              Better Auth session storage with PostgreSQL persistence and RBAC role checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="pt-3 border-t border-border flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Implemented
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card flex flex-col justify-between">
          <CardHeader>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-semibold">Google Gemini RAG</CardTitle>
            <CardDescription className="text-xs">
              Auto-classification, conversation summarization, and grounded suggested replies.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="pt-3 border-t border-border flex items-center text-xs font-medium text-muted-foreground">
              <Clock className="w-3.5 h-3.5 mr-1" /> Phase 5
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card flex flex-col justify-between">
          <CardHeader>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Mail className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-semibold">Email Webhook Ingestion</CardTitle>
            <CardDescription className="text-xs">
              Inbound webhooks from SendGrid/Mailgun with conversation thread tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="pt-3 border-t border-border flex items-center text-xs font-medium text-muted-foreground">
              <Clock className="w-3.5 h-3.5 mr-1" /> Phase 6
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default HomePage;
