import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserModal } from '../CreateUserModal';
import { api } from '@/lib/api';

describe('CreateUserModal Component Tests', () => {
  const mockOnClose = vi.fn();
  const mockOnUserCreated = vi.fn();
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnClose.mockClear();
    mockOnUserCreated.mockClear();
    postSpy = vi.spyOn(api, 'post');
  });

  describe('1. Render & Visibility', () => {
    it('does not render anything when isOpen is false', () => {
      render(
        <CreateUserModal
          isOpen={false}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Create New User')).not.toBeInTheDocument();
    });

    it('renders the modal with title, description, inputs, and action buttons when isOpen is true', () => {
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /create new user/i })).toBeInTheDocument();
      expect(screen.getByText(/add a new user account to the system/i)).toBeInTheDocument();

      // Form input fields
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();

      // Action buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/close modal/i)).toBeInTheDocument();
    });

    it('initializes input fields with empty values', () => {
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      expect(screen.getByLabelText(/full name/i)).toHaveValue('');
      expect(screen.getByLabelText(/email address/i)).toHaveValue('');
      expect(screen.getByLabelText(/^password$/i)).toHaveValue('');
    });
  });

  describe('2. Form Validation Rules', () => {
    it('shows validation errors when submitting empty form', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 3 characters')).toBeInTheDocument();
        expect(screen.getByText('Email address is required')).toBeInTheDocument();
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });

      expect(postSpy).not.toHaveBeenCalled();
    });

    it('shows error when name is shorter than 3 characters', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, 'Al');

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('shows error when name contains only whitespace', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const nameInput = screen.getByLabelText(/full name/i);
      await user.type(nameInput, '     ');

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('shows error when email format is invalid', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email-string');

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('shows error when password is shorter than 8 characters', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'Short1');

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('shows error when password contains only whitespace', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, '        '); // 8 spaces

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });
  });

  describe('3. Form Submission Flow', () => {
    it('submits valid data, calls API, closes modal, and notifies parent callback', async () => {
      const user = userEvent.setup();
      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
        data: {
          user: {
            id: 'new-user-1',
            name: 'Jane Doe',
            email: 'jane.doe@ticketai.local',
            role: 'AGENT',
            isActive: true,
          },
          message: 'User created successfully',
        },
      } as any);

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
      await user.type(screen.getByLabelText(/email address/i), 'jane.doe@ticketai.local');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePassword123!');

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/users', {
          name: 'Jane Doe',
          email: 'jane.doe@ticketai.local',
          password: 'SecurePassword123!',
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockOnUserCreated).toHaveBeenCalledTimes(1);
      });
    });

    it('trims whitespace from name and email before submitting to API', async () => {
      const user = userEvent.setup();
      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
        data: { user: { id: 'user-id' } },
      } as any);

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      await user.type(screen.getByLabelText(/full name/i), '  Jane Doe  ');
      await user.type(screen.getByLabelText(/email address/i), '  jane.doe@example.com  ');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/users', {
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          password: 'Password123!',
        });
      });
    });

    it('displays server error message when API request fails with 400', async () => {
      const user = userEvent.setup();
      vi.spyOn(api, 'post').mockRejectedValue({
        response: {
          data: {
            error: 'A user with this email already exists',
          },
        },
      });

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      await user.type(screen.getByLabelText(/full name/i), 'Existing Admin');
      await user.type(screen.getByLabelText(/email address/i), 'admin@ticketai.local');
      await user.type(screen.getByLabelText(/^password$/i), 'AdminPassword123!');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText('A user with this email already exists')).toBeInTheDocument();
      });

      // Modal should NOT close on failure
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnUserCreated).not.toHaveBeenCalled();
    });

    it('displays fallback network error message when API throws without response data', async () => {
      const user = userEvent.setup();
      vi.spyOn(api, 'post').mockRejectedValue(new Error('Network error'));

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
      await user.type(screen.getByLabelText(/email address/i), 'jane.doe@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('shows "Creating..." and disables buttons while submitting', async () => {
      const user = userEvent.setup();
      let resolveApiPost: (value: any) => void;
      postSpy.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApiPost = resolve;
          })
      );

      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
      await user.type(screen.getByLabelText(/email address/i), 'jane.doe@ticketai.local');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');

      const submitBtn = screen.getByRole('button', { name: /create user/i });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      const closeBtn = screen.getByLabelText(/close modal/i);

      // Initially enabled
      expect(submitBtn).toBeEnabled();
      expect(cancelBtn).toBeEnabled();
      expect(closeBtn).toBeEnabled();

      // Submit form
      await user.click(submitBtn);

      // During submission: verify "Creating..." text and disabled states
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /creating\.\.\./i })).toBeDisabled();
      expect(cancelBtn).toBeDisabled();
      expect(closeBtn).toBeDisabled();

      // Resolve the pending API call
      resolveApiPost!({
        data: {
          user: { id: 'user-1', name: 'Jane Doe' },
        },
      });

      // After resolution, modal closes
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('4. User Interactions & Password Visibility', () => {
    it('toggles password visibility between password and text type', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
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
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelBtn);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Header Close (X) button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const closeBtn = screen.getByLabelText(/close modal/i);
      await user.click(closeBtn);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking outside on the backdrop overlay', () => {
      render(
        <CreateUserModal
          isOpen={true}
          onClose={mockOnClose}
          onUserCreated={mockOnUserCreated}
        />
      );

      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
