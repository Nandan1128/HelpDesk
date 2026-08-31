import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Bot, Loader2 } from 'lucide-react';
import { useSession, AuthUser } from '../lib/auth-client';

export function AdminRoute() {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-md animate-pulse">
            <Bot className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Verifying admin permissions...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const user = session.user as AuthUser;
  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
