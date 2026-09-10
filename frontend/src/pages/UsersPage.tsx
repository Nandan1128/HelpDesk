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
  CheckCircle2,
  XCircle,
  UserCheck,
  Filter,
  UserPlus,
} from 'lucide-react';
import {
  UserTable,
  CreateUserModal,
  EditUserModal,
  DeleteUserModal,
  UserItem,
  UserSortField,
} from '@/components/users';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Card,
  CardHeader,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type { UserItem, UserSortField };

interface UserListResponse {
  users: UserItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type UserModal =
  | { mode: 'create' }
  | { mode: 'edit'; user: UserItem }
  | { mode: 'delete'; user: UserItem }
  | null;

export function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<UserModal>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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

      if (debouncedSearchQuery.trim()) {
        params.search = debouncedSearchQuery.trim();
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

      const fetchedUsers = (response.data.users || []).filter(
        (u) => !(u.name === 'AI' && u.role === 'AGENT') && u.email !== 'ai@ticketai.local'
      );
      setUsers(fetchedUsers);
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
  }, [debouncedSearchQuery, roleFilter, statusFilter, sortBy, sortOrder]);

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

  const toggleSort = (field: UserSortField) => {
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
            onClick={() => setModal({ mode: 'create' })}
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  roleFilter === 'ALL'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Roles
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('ADMIN')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  roleFilter === 'ADMIN'
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  roleFilter === 'AGENT'
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'ACTIVE'
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'INACTIVE'
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

      {/* Users Table / Directory */}
      <UserTable
        users={users}
        loading={loading}
        isFiltered={isFiltered}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onToggleSort={toggleSort}
        onClearFilters={handleClearFilters}
        onEditUser={(user) => setModal({ mode: 'edit', user })}
        onDeleteUser={(user) => setModal({ mode: 'delete', user })}
      />

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={modal?.mode === 'create'}
        onClose={() => setModal(null)}
        onUserCreated={() => fetchUsers(true)}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={modal?.mode === 'edit'}
        user={modal?.mode === 'edit' ? modal.user : null}
        onClose={() => setModal(null)}
        onUserUpdated={() => fetchUsers(true)}
      />

      {/* Delete User Modal */}
      <DeleteUserModal
        isOpen={modal?.mode === 'delete'}
        user={modal?.mode === 'delete' ? modal.user : null}
        onClose={() => setModal(null)}
        onUserDeleted={() => fetchUsers(true)}
      />
    </div>
  );
}

export default UsersPage;
