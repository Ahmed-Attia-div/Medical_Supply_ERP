import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  action?: ReactNode;
}

const variantStyles = {
  default: 'bg-card border border-border',
  primary: 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground',
  success: 'bg-gradient-to-br from-success to-success/80 text-success-foreground',
  warning: 'bg-gradient-to-br from-warning to-warning/80 text-warning-foreground',
  danger: 'bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground',
};

const iconStyles = {
  default: 'bg-primary/10 text-primary',
  primary: 'bg-primary-foreground/20 text-primary-foreground',
  success: 'bg-success-foreground/20 text-success-foreground',
  warning: 'bg-warning-foreground/20 text-warning-foreground',
  danger: 'bg-destructive-foreground/20 text-destructive-foreground',
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  className,
  action,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow animate-fade-in',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p
              className={cn(
                'text-sm font-medium',
                variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
              )}
            >
              {title}
            </p>
            {action}
          </div>
          <p className="text-3xl font-bold num">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-xs font-medium num',
                  trend.isPositive
                    ? variant === 'default'
                      ? 'text-success'
                      : 'text-success-foreground'
                    : variant === 'default'
                      ? 'text-destructive'
                      : 'text-destructive-foreground'
                )}
              >
                {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
              </span>
              <span
                className={cn(
                  'text-xs',
                  variant === 'default' ? 'text-muted-foreground' : 'opacity-70'
                )}
              >
                من الشهر الماضي
              </span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
