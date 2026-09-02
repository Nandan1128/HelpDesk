import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersPage, UserItem } from '../UsersPage';
import { api } from '@/lib/api';

const mockUsers: UserItem[] = [
  {
    id: 'user-1',
    name: 'Admin User',
    email: 'admin@example.com',
    emailVerified: true,
    role: 'ADMIN',
    isActive: true,
    createdAt: '2025-01-10T12:00:00.000Z',
    updatedAt: '2025-01-10T12:00:00.000Z',
    _count: { assignedTickets: 5 },
  },
  {
    id: 'user-2',
    name: 'Sarah Connor',
    email: 'sarah.agent@ticketai.local',
    emailVerified: true,
    role: 'AGENT',
    isActive: true,
    createdAt: '2025-01-15T12:00:00.000Z',
    updatedAt: '2025-01-15T12:00:00.000Z',
    _count: { assignedTickets: 12 },
  },
  {
    id: 'user-3',
    name: 'Alex Rivera',
    email: 'alex.agent@ticketai.local',
    emailVerified: true,
    role: 'AGENT',
    isActive: false,
    createdAt: '2025-02-01T12:00:00.000Z',
    updatedAt: '2025-02-01T12:00:00.000Z',
    _count: { assignedTickets: 0 },
  },
];

describe('UsersPage Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        users: mockUsers,
        pagination: { total: 3, page: 1, limit: 50, totalPages: 1 },
      },
    } as any);
  });

  describe('1. Initial Load & Layout Header', () => {
    it('renders the page title, admin security badge, and description', async () => {
      render(<UsersPage />);

      expect(screen.getByRole('heading', { level: 1, name: /users/i })).toBeInTheDocument();
      expect(screen.getByText(/admin access only/i)).toBeInTheDocument();
      expect(
        screen.getByText(/manage system administrators, support agents, and assigned ticket allocations/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays summary KPI cards with accurate metric counts', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      // Total Users: 3
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Support Agents: 2
      expect(screen.getByText('Support Agents')).toBeInTheDocument();
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

      // Administrators: 1
      expect(screen.getByText('Administrators')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();

      // Active Status: 2 active, 1 deactivated
      expect(screen.getByText('Active Status')).toBeInTheDocument();
      expect(screen.getByText('1 deactivated')).toBeInTheDocument();
    });
  });

  describe('2. Table & User Listing', () => {
    it('renders all users with avatar initials, role badges, active status, and ticket counts', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      // User names and emails in directory
      expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('admin@example.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('sarah.agent@ticketai.local').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('alex.agent@ticketai.local').length).toBeGreaterThanOrEqual(1);

      // Role Badges
      expect(screen.getAllByText('Administrator').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1);

      // Status Badges
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);

      // Ticket counts
      expect(screen.getAllByText(/5 tickets/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/12 tickets/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/0 tickets/i).length).toBeGreaterThanOrEqual(1);

      // Formatted Date
      expect(screen.getAllByText(/Jan 10, 2025/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Jan 15, 2025/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Feb 1, 2025/i).length).toBeGreaterThanOrEqual(1);
    });

    it('shows directory counter with pluralized account count', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Showing 3 accounts')).toBeInTheDocument();
      });
    });
  });

  describe('3. Search Input & Reset', () => {
    it('triggers search query param when user types in search box', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const searchInput = screen.getByRole('textbox', { name: /search users/i });
      await user.type(searchInput, 'Sarah');

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.objectContaining({
            search: 'Sarah',
          }),
        });
      });
    });

    it('shows clear search (X) button and clears text when clicked', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const searchInput = screen.getByRole('textbox', { name: /search users/i });
      await user.type(searchInput, 'Alex');

      const clearBtn = screen.getByTitle('Clear search');
      expect(clearBtn).toBeInTheDocument();

      await user.click(clearBtn);
      expect(searchInput).toHaveValue('');
    });
  });

  describe('4. Role Filtering Tabs', () => {
    it('filters users by ADMIN role when clicking Admins tab', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const adminsTab = screen.getByRole('button', { name: /admins/i });
      await user.click(adminsTab);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.objectContaining({
            role: 'ADMIN',
          }),
        });
      });
    });

    it('filters users by AGENT role when clicking Agents tab', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const agentsTab = screen.getByRole('button', { name: /agents/i });
      await user.click(agentsTab);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.objectContaining({
            role: 'AGENT',
          }),
        });
      });
    });

    it('resets role filter when clicking All Roles tab', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      // Filter by AGENT first
      const agentsTab = screen.getByRole('button', { name: /agents/i });
      await user.click(agentsTab);

      // Reset by clicking All Roles
      const allRolesTab = screen.getByRole('button', { name: /all roles/i });
      await user.click(allRolesTab);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.not.objectContaining({
            role: 'AGENT',
          }),
        });
      });
    });
  });

  describe('5. Status Filtering Tabs', () => {
    it('filters users by active status when clicking Active tab', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const activeTab = screen.getByRole('button', { name: /^active$/i });
      await user.click(activeTab);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.objectContaining({
            status: 'active',
          }),
        });
      });
    });

    it('filters users by inactive status when clicking Inactive tab', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const inactiveTab = screen.getByRole('button', { name: /^inactive$/i });
      await user.click(inactiveTab);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.objectContaining({
            status: 'inactive',
          }),
        });
      });
    });
  });

  describe('6. Sorting Headers', () => {
    it('toggles name sorting between asc and desc when clicking User column header', async () => {
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const userHeader = screen.getByRole('button', { name: /^user/i });
      fireEvent.click(userHeader);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.objectContaining({
            sortBy: 'name',
            sortOrder: 'asc',
          }),
        });
      });

      // Query fresh button element after re-render and click again for descending sort
      const updatedUserHeader = screen.getByRole('button', { name: /^user/i });
      fireEvent.click(updatedUserHeader);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users', {
          params: expect.objectContaining({
            sortBy: 'name',
            sortOrder: 'desc',
          }),
        });
      });
    });

    it('toggles role sorting when clicking Role column header', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const roleHeader = screen.getByRole('button', { name: /^role/i });
      await user.click(roleHeader);

      await waitFor(() => {
        expect(api.get).toHaveBeenLastCalledWith('/users', {
          params: expect.objectContaining({
            sortBy: 'role',
            sortOrder: 'asc',
          }),
        });
      });
    });
  });

  describe('7. Active Filters Bar & Reset', () => {
    it('shows active filter badges and clears all filters when clicking Clear all button', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      // Type in search and select role
      const searchInput = screen.getByRole('textbox', { name: /search users/i });
      await user.type(searchInput, 'Sarah');

      const agentsTab = screen.getByRole('button', { name: /agents/i });
      await user.click(agentsTab);

      // Verify active filter summary is shown
      await waitFor(() => {
        expect(screen.getByText(/active filters:/i)).toBeInTheDocument();
        expect(screen.getByText('Query: "Sarah"')).toBeInTheDocument();
        expect(screen.getByText('Role: AGENT')).toBeInTheDocument();
      });

      // Click Clear all
      const clearAllBtn = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearAllBtn);

      expect(searchInput).toHaveValue('');
      expect(screen.queryByText(/active filters:/i)).not.toBeInTheDocument();
    });
  });

  describe('8. Empty States', () => {
    it('renders filtered empty state with clear filters button when search has no match', async () => {
      const user = userEvent.setup();

      vi.spyOn(api, 'get').mockImplementation(async (_url, config) => {
        const searchParam = (config?.params as Record<string, any> | undefined)?.search;
        if (searchParam) {
          return {
            data: {
              users: [],
              pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
            },
          } as any;
        }
        return {
          data: {
            users: mockUsers,
            pagination: { total: 3, page: 1, limit: 50, totalPages: 1 },
          },
        } as any;
      });

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const searchInput = screen.getByRole('textbox', { name: /search users/i });
      await user.type(searchInput, 'UnknownPerson');

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument();
        expect(
          screen.getByText('No users match your current filter and search criteria.')
        ).toBeInTheDocument();
      });

      const clearBtn = screen.getByRole('button', { name: /clear filters/i });
      expect(clearBtn).toBeInTheDocument();
      await user.click(clearBtn);

      expect(searchInput).toHaveValue('');
    });

    it('renders system empty state when no users are in database', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          users: [],
          pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
        },
      } as any);

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument();
        expect(
          screen.getByText('There are currently no users configured in the system.')
        ).toBeInTheDocument();
      });

      // In unfiltered state, "Clear filters" is not shown
      expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
    });
  });

  describe('9. Error Alert & Retry Action', () => {
    it('displays error alert when network fails and recovers upon clicking Try Again', async () => {
      const user = userEvent.setup();

      let shouldFail = true;
      vi.spyOn(api, 'get').mockImplementation(async () => {
        if (shouldFail) {
          throw {
            response: {
              data: {
                error: 'Database connection failed',
              },
            },
          };
        }
        return {
          data: {
            users: mockUsers,
            pagination: { total: 3, page: 1, limit: 50, totalPages: 1 },
          },
        } as any;
      });

      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
      });

      // Prepare successful response for retry
      shouldFail = false;

      const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainBtn);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.queryByText('Database connection failed')).not.toBeInTheDocument();
    });
  });

  describe('10. Refresh Action', () => {
    it('refetches users when clicking the header Refresh button', async () => {
      const user = userEvent.setup();
      render(<UsersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User').length).toBeGreaterThanOrEqual(1);
      });

      const refreshBtn = screen.getByTitle('Refresh user list');
      await user.click(refreshBtn);

      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });
});
