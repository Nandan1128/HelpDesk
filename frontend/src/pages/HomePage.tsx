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
import axios from 'axios';
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
    axios
      .get<HealthStatus>('/api/health')
      .then((res) => {
        setHealth(res.data);
        setHealthError(null);
      })
      .catch((err) => {
        setHealthError(err.message || 'Failed to connect to backend');
      })
      .finally(() => {
        setHealthLoading(false);
      });
  }, []);

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Authentication Verified</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {user?.name || 'Agent'}! 👋
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              You are signed in as <span className="text-slate-200 font-medium">{user?.email}</span> with{' '}
              <span className={`font-semibold ${isAdmin ? 'text-indigo-400' : 'text-emerald-400'}`}>
                {isAdmin ? 'Administrator' : 'Support Agent'}
              </span>{' '}
              permissions.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center space-x-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                {isAdmin ? <Shield className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <div className="text-xs text-slate-400">Current Role</div>
                <div className="text-sm font-bold text-white uppercase">{user?.role || 'AGENT'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Open Tickets
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">2</div>
            <p className="text-xs text-emerald-400 flex items-center mt-1">
              <span className="font-medium">1 high priority</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Resolved
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">1</div>
            <p className="text-xs text-slate-400 mt-1">Seeded historical ticket</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              AI Summaries
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">Gemini 1.5</div>
            <p className="text-xs text-indigo-400 mt-1">RAG suggestions active</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Support Agents
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">3 active</div>
            <p className="text-xs text-slate-400 mt-1">Admin + 2 Agents</p>
          </div>
        </div>
      </div>

      {/* System Diagnostics & Backend Status */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" /> Live System Diagnostics
        </h2>

        {healthLoading ? (
          <div className="py-4 text-center text-slate-400 text-sm animate-pulse">
            Querying backend &amp; database health...
          </div>
        ) : healthError ? (
          <div className="flex items-start space-x-3 bg-red-950/40 border border-red-800/60 p-4 rounded-xl text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-medium">Backend Connection Error</p>
              <p className="text-xs text-red-400 mt-1">{healthError}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Backend API</span>
                <span className="text-sm font-semibold text-slate-200 mt-0.5">Express (Port 5000)</span>
              </div>
              <span className="flex items-center text-xs font-semibold text-emerald-400 gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> {health?.status}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">PostgreSQL Database</span>
                <span className="text-sm font-semibold text-slate-200 mt-0.5">Prisma ORM</span>
              </div>
              <span className="flex items-center text-xs font-semibold text-emerald-400 gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> {health?.database}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Auth Engine</span>
                <span className="text-sm font-semibold text-slate-200 mt-0.5">Better Auth</span>
              </div>
              <span className="flex items-center text-xs font-semibold text-blue-400 gap-1.5 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> Active Session
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Feature Modules Roadmap */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Session Authentication</h3>
            <p className="text-xs text-slate-400 mt-1">
              Better Auth session storage with PostgreSQL persistence and RBAC role checks.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center text-xs font-medium text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Implemented
          </div>
        </div>

        <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Google Gemini RAG</h3>
            <p className="text-xs text-slate-400 mt-1">
              Auto-classification, conversation summarization, and grounded suggested replies.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center text-xs font-medium text-blue-400">
            <Clock className="w-3.5 h-3.5 mr-1" /> Phase 5
          </div>
        </div>

        <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Email Webhook Ingestion</h3>
            <p className="text-xs text-slate-400 mt-1">
              Inbound webhooks from SendGrid/Mailgun with conversation thread tracking.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center text-xs font-medium text-blue-400">
            <Clock className="w-3.5 h-3.5 mr-1" /> Phase 6
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
