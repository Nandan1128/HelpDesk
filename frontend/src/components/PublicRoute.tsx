import { Navigate, Outlet } from 'react-router-dom';
import { Bot, Loader2 } from 'lucide-react';
import { useSession } from '../lib/auth-client';

export function PublicRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-200">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div className="flex items-center space-x-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (session?.user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default PublicRoute;
