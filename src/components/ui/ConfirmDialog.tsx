import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'جاري...' : confirmText}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center py-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            variant === 'danger'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-warning/10 text-warning'
          }`}
        >
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </Modal>
  );
}
