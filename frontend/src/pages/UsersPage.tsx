import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Users,
  Shield,
  Headphones,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  Ticket,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  Filter,
  ArrowUpDown,
  Mail,
  Calendar,
  UserPlus,
} from 'lucide-react';
import { CreateUserModal } from '@/components/CreateUserModal';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: 'ADMIN' | 'AGENT';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assignedTickets: number;
  };
}

interface UserListResponse {
  users: UserItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'AGENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'email' | 'role'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchUsers = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params: Record<string, string> = {
        sortBy,
        sortOrder,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (roleFilter !== 'ALL') {
        params.role = roleFilter;
      }
      if (statusFilter === 'ACTIVE') {
        params.status = 'active';
      } else if (statusFilter === 'INACTIVE') {
        params.status = 'inactive';
      }

      const response = await api.get<UserListResponse>('/users', {
        params,
      });

      setUsers(response.data.users || []);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to load users. Please check your connection.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, roleFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Quick stats computed from current full or unfiltered view
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'ADMIN').length;
    const agents = users.filter((u) => u.role === 'AGENT').length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;

    return { total, admins, agents, active, inactive };
  }, [users]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const isFiltered = searchQuery.trim() !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const toggleSort = (field: 'createdAt' | 'name' | 'email' | 'role') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Users
            </h1>
            <Badge variant="secondary" className="font-semibold text-xs py-0.5">
              <Shield className="w-3 h-3 mr-1 text-indigo-500" />
              Admin Access Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system administrators, support agents, and assigned ticket allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-2 cursor-pointer"
            title="Create new user"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(true)}
            disabled={refreshing || loading}
            className="gap-2 cursor-pointer"
            title="Refresh user list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Support Agents
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Headphones className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{stats.agents}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Queue handlers</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Administrators
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{stats.admins}</div>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Full access</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Status
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{stats.active}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.inactive > 0 ? `${stats.inactive} deactivated` : 'All accounts active'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Search className="w-4 h-4" />
              </div>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-9 pr-8"
                aria-label="Search users"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setRoleFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${roleFilter === 'ALL'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                All Roles
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('ADMIN')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${roleFilter === 'ADMIN'
                  ? 'bg-background text-indigo-500 dark:text-indigo-400 font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Shield className="w-3 h-3" />
                Admins
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('AGENT')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${roleFilter === 'AGENT'
                  ? 'bg-background text-emerald-500 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Headphones className="w-3 h-3" />
                Agents
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${statusFilter === 'ALL'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${statusFilter === 'ACTIVE'
                  ? 'bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${statusFilter === 'INACTIVE'
                  ? 'bg-background text-muted-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <XCircle className="w-3 h-3 text-muted-foreground" />
                Inactive
              </button>
            </div>
          </div>

          {/* Active Filter summary & Reset */}
          {isFiltered && (
            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3 h-3 text-primary" />
                <span>Active filters:</span>
                {searchQuery && (
                  <Badge variant="outline" className="text-[11px] gap-1 py-0 px-2">
                    Query: "{searchQuery}"
                  </Badge>
                )}
                {roleFilter !== 'ALL' && (
                  <Badge variant="outline" className="text-[11px] gap-1 py-0 px-2">
                    Role: {roleFilter}
                  </Badge>
                )}
                {statusFilter !== 'ALL' && (
                  <Badge variant="outline" className="text-[11px] gap-1 py-0 px-2">
                    Status: {statusFilter}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-6 px-2 text-xs text-primary hover:text-primary/80 cursor-pointer"
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers()}
              className="h-7 text-xs ml-4 border-red-500/30 text-red-600 hover:bg-red-500/20 cursor-pointer"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Users Table / List */}
      <Card className="border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">User Directory</CardTitle>
            <CardDescription className="text-xs">
              Showing {users.length} {users.length === 1 ? 'account' : 'accounts'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                  <div className="h-6 bg-muted rounded w-20" />
                  <div className="h-6 bg-muted rounded w-16" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center text-muted-foreground mb-3">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No users found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {isFiltered
                  ? 'No users match your current filter and search criteria.'
                  : 'There are currently no users configured in the system.'}
              </p>
              {isFiltered && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="mt-4 cursor-pointer"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/40">
                      <TableHead className="w-[300px]">
                        <button
                          type="button"
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          User
                          <ArrowUpDown className="w-3 h-3 ml-0.5" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort('role')}
                          className="inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Role
                          <ArrowUpDown className="w-3 h-3 ml-0.5" />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        Status
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        Assigned Tickets
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort('createdAt')}
                          className="inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Joined
                          <ArrowUpDown className="w-3 h-3 ml-0.5" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isAdmin = user.role === 'ADMIN';
                      const ticketsCount = user._count?.assignedTickets ?? 0;

                      return (
                        <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                          {/* User Name & Email */}
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${isAdmin
                                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  }`}
                              >
                                {getInitials(user.name)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground text-sm">
                                  {user.name}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Role Badge */}
                          <TableCell>
                            {isAdmin ? (
                              <Badge
                                variant="outline"
                                className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 gap-1.5 font-medium"
                              >
                                <Shield className="w-3 h-3" />
                                Administrator
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 font-medium"
                              >
                                <Headphones className="w-3 h-3" />
                                Support Agent
                              </Badge>
                            )}
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell>
                            {user.isActive ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-muted text-muted-foreground border-border gap-1.5"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                Inactive
                              </Badge>
                            )}
                          </TableCell>

                          {/* Assigned Tickets */}
                          <TableCell>
                            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground font-medium">
                              <Ticket className="w-3.5 h-3.5 text-primary/70" />
                              <span>{ticketsCount} {ticketsCount === 1 ? 'ticket' : 'tickets'}</span>
                            </div>
                          </TableCell>

                          {/* Joined Date */}
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1.5">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(user.createdAt)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-border">
                {users.map((user) => {
                  const isAdmin = user.role === 'ADMIN';
                  const ticketsCount = user._count?.assignedTickets ?? 0;

                  return (
                    <div key={user.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${isAdmin
                              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}
                          >
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>

                        {user.isActive ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-muted text-muted-foreground border-border text-[10px] py-0 px-1.5"
                          >
                            Inactive
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center space-x-2">
                          {isAdmin ? (
                            <Badge
                              variant="outline"
                              className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 gap-1 text-[11px]"
                            >
                              <Shield className="w-2.5 h-2.5" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]"
                            >
                              <Headphones className="w-2.5 h-2.5" />
                              Agent
                            </Badge>
                          )}
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Ticket className="w-3 h-3" />
                            {ticketsCount} tickets
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[11px]">
                          Joined {formatDate(user.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onUserCreated={() => fetchUsers(true)}
      />
    </div>
  );
}

export default UsersPage;
