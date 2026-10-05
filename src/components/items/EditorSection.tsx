import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * One block of the item editor. On the full page it is a section card with an
 * icon header; in the compact dialog it is a lighter, hairline-separated block.
 */
export function EditorSection({
  title,
  description,
  icon: Icon,
  dense,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  dense?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  if (dense) {
    return (
      <section className={cn('space-y-3 border-t pt-5 first:border-t-0 first:pt-0', className)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-medium leading-tight">{title}</h3>
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 space-y-1.5">
            <h2 className="font-semibold leading-none tracking-tight">{title}</h2>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

/** Label + control + hint/error, spaced like the original form fields. */
export function EditorField({
  id,
  label,
  required,
  hint,
  error,
  dense,
  children,
  className,
}: {
  id?: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  dense?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(dense ? 'space-y-1.5' : 'space-y-2', className)}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive" aria-hidden="true">*</span>}
      </Label>
      {children}
      {hint && !error && <div className="text-xs text-muted-foreground">{hint}</div>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
