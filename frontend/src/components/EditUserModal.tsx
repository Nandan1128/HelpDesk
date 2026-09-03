import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserCheck,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserItem } from './UserTable';

const editUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .trim()
    .refine((val) => val === '' || val.length >= 8, {
      message: 'Password must be at least 8 characters',
    })
    .optional(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export interface EditUserModalProps {
  isOpen: boolean;
  user: UserItem | null;
  onClose: () => void;
  onUserUpdated?: () => void;
}

export function EditUserModal({
  isOpen,
  user,
  onClose,
  onUserUpdated,
}: EditUserModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      password: '',
    },
    mode: 'onTouched',
  });

  // Re-populate form when user or isOpen changes
  useEffect(() => {
    if (isOpen && user) {
      reset({
        name: user.name,
        email: user.email,
        password: '',
      });
      setServerError(null);
      setShowPassword(false);
    }
  }, [isOpen, user, reset]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !user) return null;

  const onSubmit = async (values: EditUserFormValues) => {
    setServerError(null);

    const payload: Record<string, any> = {
      name: values.name.trim(),
      email: values.email.trim(),
    };

    if (values.password && values.password.trim().length >= 8) {
      payload.password = values.password.trim();
    }

    try {
      await api.patch(`/users/${user.id}`, payload);

      reset();
      onClose();
      if (onUserUpdated) {
        onUserUpdated();
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to update user. Please check your connection.';
      setServerError(message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
      aria-labelledby="edit-user-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md bg-card text-card-foreground border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="edit-user-modal-title"
                className="text-lg font-bold tracking-tight text-foreground"
              >
                Edit User
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update account details for {user.name}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
          {/* Server Error Alert */}
          {serverError && (
            <Alert
              variant="destructive"
              className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 py-2.5"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <AlertDescription className="text-xs font-medium">
                {serverError}
              </AlertDescription>
            </Alert>
          )}

          {/* Name Field */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-user-name">Full Name</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <User className="w-4 h-4" />
              </div>
              <Input
                id="edit-user-name"
                type="text"
                placeholder="e.g. John Doe"
                autoComplete="name"
                {...register('name')}
                className={`pl-9 ${
                  errors.name
                    ? '!border-red-500 !ring-red-500/20 focus-visible:!border-red-500 focus-visible:!ring-red-500/30'
                    : ''
                }`}
                aria-invalid={!!errors.name}
              />
            </div>
            {errors.name && (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{errors.name.message}</span>
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-user-email">Email Address</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Mail className="w-4 h-4" />
              </div>
              <Input
                id="edit-user-email"
                type="email"
                placeholder="e.g. john.doe@example.com"
                autoComplete="email"
                {...register('email')}
                className={`pl-9 ${
                  errors.email
                    ? '!border-red-500 !ring-red-500/20 focus-visible:!border-red-500 focus-visible:!ring-red-500/30'
                    : ''
                }`}
                aria-invalid={!!errors.email}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{errors.email.message}</span>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-user-password">Password</Label>
              <span className="text-[11px] text-muted-foreground">Optional</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                id="edit-user-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
                {...register('password')}
                className={`pl-9 pr-10 ${
                  errors.password
                    ? '!border-red-500 !ring-red-500/20 focus-visible:!border-red-500 focus-visible:!ring-red-500/30'
                    : ''
                }`}
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password ? (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{errors.password.message}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave blank to keep current password. If entered, must be at least 8 characters.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserModal;
