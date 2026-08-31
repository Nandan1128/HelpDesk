import { useEffect, useState } from 'react';
import { Bot, ShieldCheck, Ticket, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface HealthStatus {
  status: string;
  database: string;
  timestamp: string;
  version: string;
}

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<HealthStatus>('/api/health')
      .then((res) => {
        setHealth(res.data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Failed to connect to backend');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">TicketAI</h1>
            <p className="text-xs text-slate-400">AI-Powered Ticket Management</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Phase 1: Project Foundations
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Full-Stack Project Ready
          </h2>
          <p className="mt-3 text-base text-slate-400">
            Express, React, TypeScript, Bun, Prisma, and PostgreSQL foundation initialized successfully.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur max-w-xl mx-auto w-full mb-10">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" /> System Diagnostics
          </h3>

          {loading ? (
            <div className="py-4 text-center text-slate-400 text-sm animate-pulse">
              Checking backend connection...
            </div>
          ) : error ? (
            <div className="flex items-start space-x-3 bg-red-950/40 border border-red-800/60 p-4 rounded-xl text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="font-medium">Backend Not Reachable</p>
                <p className="text-xs text-red-400 mt-1">{error}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Ensure the backend is running with <code className="bg-slate-900 px-1.5 py-0.5 rounded">bun run dev:backend</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                <span className="text-sm text-slate-400">Backend API</span>
                <span className="flex items-center text-xs font-semibold text-emerald-400 gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Healthy (Port 5000)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                <span className="text-sm text-slate-400">Database Connection</span>
                <span className="flex items-center text-xs font-semibold text-emerald-400 gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {health?.database}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                <span className="text-sm text-slate-400">Server Timestamp</span>
                <span className="text-xs font-mono text-slate-300">{health?.timestamp}</span>
              </div>
            </div>
          )}
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-white text-sm">Auth & Session RBAC</h4>
            <p className="text-xs text-slate-400 mt-1">
              Admin & Agent user management backed by PostgreSQL sessions.
            </p>
          </div>
          <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Bot className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-white text-sm">Google Gemini RAG</h4>
            <p className="text-xs text-slate-400 mt-1">
              Auto-classification, conversation summaries, and grounded suggested replies.
            </p>
          </div>
          <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Ticket className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-white text-sm">Email Ingestion</h4>
            <p className="text-xs text-slate-400 mt-1">
              Inbound webhooks, thread tracking, and outbound agent dispatch.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        AI-Powered Ticket Management System &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
export default App;
