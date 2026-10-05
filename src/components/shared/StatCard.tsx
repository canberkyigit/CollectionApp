import type { LucideIcon } from 'lucide-react';

import { TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn, formatPercent } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** Rendered inside the soft primary circle in the top-right corner. */
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  const hasMeta = Boolean(trend || subtitle);

  return (
    <Card className={cn('h-full overflow-hidden', className)}>
      <CardContent className={cn(
        'flex h-full flex-col p-4 sm:p-5',
        hasMeta ? 'justify-between' : 'justify-start',
      )}>
        <div className={cn(
          'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-4',
          hasMeta ? 'min-h-[4rem] sm:min-h-[4.5rem]' : 'min-h-[3.25rem] sm:min-h-[3.75rem]',
        )}>
          <div className="min-w-0 space-y-1 pr-1 sm:pr-2">
            <p className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">
              {title}
            </p>
            <p className="text-xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl">
              {value}
            </p>
          </div>
          {Icon && (
            <div className="shrink-0 rounded-full bg-primary/10 p-2 sm:p-2.5" aria-hidden="true">
              <Icon className="size-4 text-primary sm:size-5" />
            </div>
          )}
        </div>

        {hasMeta && (
          <div className="mt-2 flex min-h-5 min-w-0 items-center gap-2 sm:mt-3">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                  trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="size-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3.5" aria-hidden="true" />
                )}
                <span>{formatPercent(Math.abs(trend.value))}</span>
              </span>
            )}
            {subtitle && (
              <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm" title={subtitle}>{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
