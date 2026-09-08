import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Bot,
  LogOut,
  Shield,
  Headphones,
  LayoutDashboard,
  Users,
  Ticket,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { signOut, useSession, AuthUser } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Navbar() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = session?.user as AuthUser | undefined;

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const role = user?.role || 'AGENT';
  const isAdmin = role === 'ADMIN';

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
                <Bot className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-foreground tracking-tight">TicketAI</span>
                  <Badge variant="secondary" className="text-[10px] uppercase font-semibold px-1.5 py-0">
                    v1.0
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium">Smart Support Desk</p>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/'
                    ? 'bg-muted text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              {isAdmin && (
                <Link
                  to="/users"
                  className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/users'
                      ? 'bg-muted text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </Link>
              )}
              <Link
                to="/tickets"
                className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/tickets')
                    ? 'bg-muted text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                <Ticket className="w-4 h-4 mr-2" />
                Tickets
              </Link>
              <span
                className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                title="Available in Phase 5"
              >
                <BookOpen className="w-4 h-4 mr-2 opacity-50" />
                Knowledge Base
              </span>
            </nav>
          </div>

          {/* Right: User Information & Sign Out Button */}
          {user && (
            <div className="flex items-center space-x-4">
              {/* User Identity Chip */}
              <div className="flex items-center space-x-3 bg-card border border-border rounded-full py-1.5 px-3 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-xs">
                  {getInitials(user.name)}
                </div>
                <div className="hidden sm:flex flex-col text-left pr-1">
                  <span className="text-xs font-semibold text-foreground max-w-[140px] truncate" title={user.name}>
                    {user.name}
                  </span>
                  <div className="flex items-center space-x-1">
                    {isAdmin ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
                        <Shield className="w-3 h-3 mr-0.5" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-semibold text-emerald-500 dark:text-emerald-400">
                        <Headphones className="w-3 h-3 mr-0.5" />
                        Agent
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign Out Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                title="Sign out of TicketAI"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-destructive mr-1.5" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-1.5 text-muted-foreground group-hover:text-destructive" />
                    <span className="hidden sm:inline">Sign out</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
