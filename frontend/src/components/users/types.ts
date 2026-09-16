import type { Role, UserItem, UserSortField, UserSortOrder } from '@core';

export type { Role, UserItem, UserSortField, UserSortOrder };

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
