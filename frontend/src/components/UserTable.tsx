import {
  Shield,
  Headphones,
  UserX,
  ArrowUpDown,
  Mail,
  Calendar,
  Ticket,
  Pencil,
  Trash2,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: 'ADMIN' | 'AGENT';
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assignedTickets: number;
  };
}

export type UserSortField = 'createdAt' | 'name' | 'email' | 'role';
export type UserSortOrder = 'asc' | 'desc';

export interface UserTableProps {
  users: UserItem[];
  loading?: boolean;
  isFiltered?: boolean;
  sortBy?: UserSortField;
  sortOrder?: UserSortOrder;
  onToggleSort?: (field: UserSortField) => void;
  onClearFilters?: () => void;
  onEditUser?: (user: UserItem) => void;
  onDeleteUser?: (user: UserItem) => void;
}

export function UserTable({
  users,
  loading = false,
  isFiltered = false,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onToggleSort,
  onClearFilters,
  onEditUser,
  onDeleteUser,
}: UserTableProps) {
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

  const renderSortIcon = (field: UserSortField) => {
    const isActive = sortBy === field;
    return (
      <ArrowUpDown
        className={`w-3 h-3 ml-0.5 transition-transform ${
          isActive ? 'text-primary' : 'opacity-40'
        } ${isActive && sortOrder === 'desc' ? 'rotate-180' : ''}`}
      />
    );
  };

  return (
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
            {isFiltered && onClearFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
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
                        onClick={() => onToggleSort?.('name')}
                        className="inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        User
                        {renderSortIcon('name')}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => onToggleSort?.('role')}
                        className="inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Role
                        {renderSortIcon('role')}
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
                        onClick={() => onToggleSort?.('createdAt')}
                        className="inline-flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Joined
                        {renderSortIcon('createdAt')}
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px] text-right font-semibold text-xs uppercase tracking-wider">
                      Actions
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
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${
                                isAdmin
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
                            <span>
                              {ticketsCount} {ticketsCount === 1 ? 'ticket' : 'tickets'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Joined Date */}
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(user.createdAt)}</span>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditUser?.(user)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                              title={`Edit ${user.name}`}
                              aria-label={`Edit ${user.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {!isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteUser?.(user)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                title={`Delete ${user.name}`}
                                aria-label={`Delete ${user.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
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
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                            isAdmin
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

                      <div className="flex items-center gap-1.5">
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditUser?.(user)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title={`Edit ${user.name}`}
                            aria-label={`Edit ${user.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {!isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteUser?.(user)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              title={`Delete ${user.name}`}
                              aria-label={`Delete ${user.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
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
  );
}

export { UserTable as UsersTable };
export default UserTable;
