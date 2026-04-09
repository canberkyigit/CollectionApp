import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  hint?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  eyebrow,
  action,
  secondaryAction,
  hint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center',
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
        <Icon className="size-7 text-primary/80" />
      </div>
      {eyebrow && (
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Button onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {hint && (
        <p className="mt-4 max-w-md text-xs leading-5 text-muted-foreground/80">
          {hint}
        </p>
      )}
    </div>
  );
}
