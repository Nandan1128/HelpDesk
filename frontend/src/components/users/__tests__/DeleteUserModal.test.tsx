import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteUserModal } from '../DeleteUserModal';
import type { UserItem } from '../types';
import { api } from '@/lib/api';

describe('DeleteUserModal Component Tests', () => {
  const mockOnClose = vi.fn();
  const mockOnUserDeleted = vi.fn();
  let deleteSpy: ReturnType<typeof vi.spyOn>;

  const agentUser: UserItem = {
    id: 'agent-1',
    name: 'Sarah Connor',
    email: 'sarah.connor@ticketai.local',
    emailVerified: true,
    image: null,
    role: 'AGENT',
    isActive: true,
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
    _count: {
      assignedTickets: 5,
    },
  };

  const adminUser: UserItem = {
    id: 'admin-1',
    name: 'Root Administrator',
    email: 'admin@ticketai.local',
    emailVerified: true,
    image: null,
    role: 'ADMIN',
    isActive: true,
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-01T10:00:00.000Z',
    _count: {
      assignedTickets: 0,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnClose.mockClear();
    mockOnUserDeleted.mockClear();
    deleteSpy = vi.spyOn(api, 'delete');
  });

  describe('1. Render & Visibility', () => {
    it('does not render anything when isOpen is false', () => {
      render(
        <DeleteUserModal
          isOpen={false}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
    });

    it('does not render anything when user is null', () => {
      render(
        <DeleteUserModal
          isOpen={true}
          user={null}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
    });

    it('renders the confirmation dialog with user details and confirmation warning', () => {
      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /delete user/i })).toBeInTheDocument();

      // User details
      expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('sarah.connor@ticketai.local')).toBeInTheDocument();
      expect(screen.getByText('Support Agent')).toBeInTheDocument();

      // Confirmation warning
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();

      // Buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete user/i })).toBeEnabled();
    });

    it('displays notice about assigned tickets being unassigned when user has tickets assigned', () => {
      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      expect(screen.getByText(/All assigned tickets will be unassigned automatically/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not display assigned tickets notice when user has 0 assigned tickets', () => {
      render(
        <DeleteUserModal
          isOpen={true}
          user={{ ...agentUser, _count: { assignedTickets: 0 } }}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      expect(screen.queryByText(/All assigned tickets will be unassigned automatically/i)).not.toBeInTheDocument();
    });
  });

  describe('2. Admin Protection Rule', () => {
    it('disables Delete User button and shows protection alert when user is ADMIN', () => {
      render(
        <DeleteUserModal
          isOpen={true}
          user={adminUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      expect(screen.getByText('Root Administrator')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();

      // Admin protection notice
      expect(screen.getByText(/administrator accounts cannot be deleted/i)).toBeInTheDocument();

      // Delete button must be disabled
      const deleteBtn = screen.getByRole('button', { name: /delete user/i });
      expect(deleteBtn).toBeDisabled();

      // Clicking does not dispatch API call
      fireEvent.click(deleteBtn);
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Delete User Confirmation Flow', () => {
    it('calls DELETE /api/users/:id, closes modal, and notifies parent on success', async () => {
      const user = userEvent.setup();
      deleteSpy.mockResolvedValue({
        data: {
          user: { ...agentUser, isActive: false },
          message: 'User deactivated successfully',
        },
      } as any);

      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /delete user/i });
      await user.click(deleteBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('/users/agent-1');
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockOnUserDeleted).toHaveBeenCalledTimes(1);
      });
    });

    it('shows "Deleting..." and disables buttons during API call', async () => {
      const user = userEvent.setup();
      let resolveDelete: (value: any) => void;
      deleteSpy.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve;
          })
      );

      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /delete user/i });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      const closeBtn = screen.getByLabelText(/close modal/i);

      expect(deleteBtn).toBeEnabled();
      expect(cancelBtn).toBeEnabled();
      expect(closeBtn).toBeEnabled();

      await user.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /deleting\.\.\./i })).toBeDisabled();
      expect(cancelBtn).toBeDisabled();
      expect(closeBtn).toBeDisabled();

      resolveDelete!({
        data: { user: { ...agentUser, isActive: false } },
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('displays server error banner when API call fails', async () => {
      const user = userEvent.setup();
      deleteSpy.mockRejectedValue({
        response: {
          data: {
            error: 'Administrator accounts cannot be deleted',
          },
        },
      });

      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /delete user/i });
      await user.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText('Administrator accounts cannot be deleted')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnUserDeleted).not.toHaveBeenCalled();
    });

    it('displays fallback network error message when API rejects without response payload', async () => {
      const user = userEvent.setup();
      deleteSpy.mockRejectedValue(new Error('Network disconnected'));

      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /delete user/i });
      await user.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText('Network disconnected')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('4. Dismissal Interactions', () => {
    it('calls onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelBtn);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when header close (X) button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      const closeBtn = screen.getByLabelText(/close modal/i);
      await user.click(closeBtn);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      render(
        <DeleteUserModal
          isOpen={true}
          user={agentUser}
          onClose={mockOnClose}
          onUserDeleted={mockOnUserDeleted}
        />
      );

      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
