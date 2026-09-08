import { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { DeleteUserModalProps } from './types';

export function DeleteUserModal({
  isOpen,
  user,
  onClose,
  onUserDeleted,
}: DeleteUserModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Clear state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !user) return null;

  const isAdmin = user.role === 'ADMIN';

  const handleDelete = async () => {
    if (isAdmin) {
      setServerError('Administrator accounts cannot be deleted.');
      return;
    }

    setServerError(null);
    setIsDeleting(true);

    try {
      await api.delete(`/users/${user.id}`);
      setIsDeleting(false);
      onClose();
      if (onUserDeleted) {
        onUserDeleted();
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to delete user. Please try again.';
      setServerError(message);
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
      aria-labelledby="delete-user-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
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
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="delete-user-modal-title"
                className="text-lg font-bold tracking-tight text-foreground"
              >
                Delete User
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Are you sure you want to delete this user?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
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

          {/* User Preview Card */}
          <div className="p-3.5 rounded-lg border border-border bg-muted/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge
              variant="outline"
              className={
                isAdmin
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              }
            >
              {isAdmin ? 'Administrator' : 'Support Agent'}
            </Badge>
          </div>

          {/* Protection Notice or Warning */}
          {isAdmin ? (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Admin Protected:</strong> Administrator accounts cannot be deleted.
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{user.name}</strong>? This action cannot be undone.
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || isAdmin}
              className="gap-1.5 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete User</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeleteUserModal;
