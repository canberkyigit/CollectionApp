import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ChevronRight } from 'lucide-react';

import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const t = useT();

  return (
    <div className={cn('space-y-2 sm:space-y-3', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label={t('shell.breadcrumbs')} className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3 sm:size-3.5" aria-hidden="true" />}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground" aria-current="page">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 max-w-3xl space-y-1.5 sm:space-y-2">
          <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  );
}
