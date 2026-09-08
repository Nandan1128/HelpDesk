import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditUserModal } from '../EditUserModal';
import type { UserItem } from '../types';
import { api } from '@/lib/api';

describe('EditUserModal Component Tests', () => {
  const mockOnClose = vi.fn();
  const mockOnUserUpdated = vi.fn();
  let patchSpy: ReturnType<typeof vi.spyOn>;

  const sampleUser: UserItem = {
    id: 'user-42',
    name: 'Sarah Connor',
    email: 'sarah.connor@ticketai.local',
    emailVerified: true,
    image: null,
    role: 'AGENT',
    isActive: true,
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
    _count: {
      assignedTickets: 3,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnClose.mockClear();
    mockOnUserUpdated.mockClear();
    patchSpy = vi.spyOn(api, 'patch');
  });

  describe('1. Render & Visibility', () => {
    it('does not render anything when isOpen is false', () => {
      render(
        <EditUserModal
          isOpen={false}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit User')).not.toBeInTheDocument();
    });

    it('does not render anything when user is null', () => {
      render(
        <EditUserModal
          isOpen={true}
          user={null}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit User')).not.toBeInTheDocument();
    });

    it('renders the dialog and pre-populates name and email fields from user data', () => {
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument();
      expect(screen.getByText(/update account details for Sarah Connor/i)).toBeInTheDocument();

      // Pre-populated fields
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Sarah Connor');
      expect(screen.getByLabelText(/email address/i)).toHaveValue('sarah.connor@ticketai.local');

      // Password starts empty with placeholder
      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveValue('');
      expect(passwordInput).toHaveAttribute('placeholder', 'Leave blank to keep current password');

      // Buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('2. Form Validation Rules', () => {
    it('shows error when name is shorter than 3 characters', async () => {
      const user = userEvent.setup();
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const nameInput = screen.getByLabelText(/full name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Jo');

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 3 characters')).toBeInTheDocument();
      });

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('shows error when name is whitespace only', async () => {
      const user = userEvent.setup();
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const nameInput = screen.getByLabelText(/full name/i);
      await user.clear(nameInput);
      await user.type(nameInput, '     ');

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 3 characters')).toBeInTheDocument();
      });

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('shows error when email is cleared or invalid', async () => {
      const user = userEvent.setup();
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'not-an-email');

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('allows submission when password is left blank (preserves existing password)', async () => {
      const user = userEvent.setup();
      patchSpy.mockResolvedValue({
        data: { user: { ...sampleUser, name: 'Sarah Connor Updated' } },
      } as any);

      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const nameInput = screen.getByLabelText(/full name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Sarah Connor Updated');

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith('/users/user-42', {
          name: 'Sarah Connor Updated',
          email: 'sarah.connor@ticketai.local',
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockOnUserUpdated).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error when password is typed but shorter than 8 characters', async () => {
      const user = userEvent.setup();
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, '12345'); // < 8 chars

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });

      expect(patchSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Form Submission Flow', () => {
    it('submits updated name, email, and new password when password is provided', async () => {
      const user = userEvent.setup();
      patchSpy.mockResolvedValue({
        data: { user: { ...sampleUser, name: 'Sarah Smith' } },
      } as any);

      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      await user.clear(nameInput);
      await user.type(nameInput, 'Sarah Smith');

      await user.clear(emailInput);
      await user.type(emailInput, 'sarah.smith@ticketai.local');

      await user.type(passwordInput, 'NewSecurePassword123!');

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith('/users/user-42', {
          name: 'Sarah Smith',
          email: 'sarah.smith@ticketai.local',
          password: 'NewSecurePassword123!',
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockOnUserUpdated).toHaveBeenCalledTimes(1);
      });
    });

    it('shows "Saving..." and disables buttons while submitting', async () => {
      const user = userEvent.setup();
      let resolvePatch: (value: any) => void;
      patchSpy.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePatch = resolve;
          })
      );

      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      const closeBtn = screen.getByLabelText(/close modal/i);

      expect(submitBtn).toBeEnabled();
      expect(cancelBtn).toBeEnabled();
      expect(closeBtn).toBeEnabled();

      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /saving\.\.\./i })).toBeDisabled();
      expect(cancelBtn).toBeDisabled();
      expect(closeBtn).toBeDisabled();

      resolvePatch!({
        data: { user: sampleUser },
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('displays server error message when API fails with 400', async () => {
      const user = userEvent.setup();
      patchSpy.mockRejectedValue({
        response: {
          data: {
            error: 'A user with this email already exists',
          },
        },
      });

      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'existing.admin@ticketai.local');

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('A user with this email already exists')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnUserUpdated).not.toHaveBeenCalled();
    });

    it('displays fallback network error message when API throws without response data', async () => {
      const user = userEvent.setup();
      patchSpy.mockRejectedValue(new Error('Connection failed'));

      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('4. User Interactions', () => {
    it('toggles password visibility between password and text type', async () => {
      const user = userEvent.setup();
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const showBtn = screen.getByLabelText(/show password/i);
      await user.click(showBtn);

      expect(passwordInput).toHaveAttribute('type', 'text');

      const hideBtn = screen.getByLabelText(/hide password/i);
      await user.click(hideBtn);

      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('calls onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelBtn);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Header Close (X) button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const closeBtn = screen.getByLabelText(/close modal/i);
      await user.click(closeBtn);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking outside on the backdrop overlay', () => {
      render(
        <EditUserModal
          isOpen={true}
          user={sampleUser}
          onClose={mockOnClose}
          onUserUpdated={mockOnUserUpdated}
        />
      );

      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
