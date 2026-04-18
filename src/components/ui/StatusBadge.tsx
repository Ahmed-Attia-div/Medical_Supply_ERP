import { cn } from '@/lib/utils';
import { StockStatus } from '@/types/inventory';

interface StatusBadgeProps {
  status: StockStatus | 'success' | 'warning';
  label?: string; // Optional custom label
  className?: string;
}

const statusConfig = {
  low: {
    label: 'منخفض',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  medium: {
    label: 'متوسط',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  good: {
    label: 'جيد',
    className: 'bg-success/10 text-success border-success/20',
  },
  success: {
    label: 'نجح',
    className: 'bg-success/10 text-success border-success/20',
  },
  warning: {
    label: 'تحذير',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full ml-1.5',
          (status === 'low') && 'bg-destructive animate-pulse',
          (status === 'medium' || status === 'warning') && 'bg-warning',
          (status === 'good' || status === 'success') && 'bg-success'
        )}
      />
      {displayLabel}
    </span>
  );
}
