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

export interface AgentUser {
  id: string;
  name: string;
  email: string;
  role: Role | string;
}

export type UserSortField = 'createdAt' | 'name' | 'email' | 'role';
export type UserSortOrder = 'asc' | 'desc';

export interface UserListResponse {
  users: UserItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
