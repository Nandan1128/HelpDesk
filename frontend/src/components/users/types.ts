export type Role = 'ADMIN' | 'AGENT';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: Role;
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

export interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated?: () => void;
}

export interface EditUserModalProps {
  isOpen: boolean;
  user: UserItem | null;
  onClose: () => void;
  onUserUpdated?: () => void;
}

export interface DeleteUserModalProps {
  isOpen: boolean;
  user: UserItem | null;
  onClose: () => void;
  onUserDeleted?: () => void;
}
