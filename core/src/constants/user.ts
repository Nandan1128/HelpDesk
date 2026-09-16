import type { Role } from '../types/user.js';

export const USER_ROLES: readonly Role[] = ['ADMIN', 'AGENT'] as const;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  AGENT: 'Support Agent',
};
