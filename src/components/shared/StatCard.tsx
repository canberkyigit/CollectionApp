import type { LucideIcon } from 'lucide-react';

import { TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
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
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
            <p className="text-xl font-bold tracking-tight sm:text-3xl">{value}</p>
          </div>
          <div className="shrink-0 rounded-full bg-primary/10 p-2 sm:p-2.5">
            <Icon className="size-4 text-primary sm:size-5" />
          </div>
        </div>

        {(trend || subtitle) && (
          <div className="mt-2 flex items-center gap-2 sm:mt-3">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600',
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {Math.abs(trend.value).toFixed(1)}%
              </span>
            )}
            {subtitle && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
