import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Bot,
  LogOut,
  Shield,
  Headphones,
  LayoutDashboard,
  Ticket,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { signOut, useSession, AuthUser } from '../lib/auth-client';

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
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-white tracking-tight">TicketAI</span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    v1.0
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">Smart Support Desk</p>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/'
                    ? 'bg-slate-800 text-blue-400 font-semibold shadow-inner'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              <span
                className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed"
                title="Available in Phase 4"
              >
                <Ticket className="w-4 h-4 mr-2 opacity-50" />
                Tickets
              </span>
              <span
                className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed"
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
              <div className="flex items-center space-x-3 bg-slate-900/90 border border-slate-800 rounded-full py-1.5 px-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {getInitials(user.name)}
                </div>
                <div className="hidden sm:flex flex-col text-left pr-1">
                  <span className="text-xs font-semibold text-slate-100 max-w-[140px] truncate" title={user.name}>
                    {user.name}
                  </span>
                  <div className="flex items-center space-x-1">
                    {isAdmin ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-indigo-400">
                        <Shield className="w-3 h-3 mr-0.5" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400">
                        <Headphones className="w-3 h-3 mr-0.5" />
                        Agent
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 border border-slate-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500/40 cursor-pointer"
                title="Sign out of TicketAI"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 text-slate-400" />
                    <span className="hidden sm:inline">Sign out</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
