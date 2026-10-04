import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PanelCardHeaderProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Neutral icon tile (used for locked / unavailable states). */
  muted?: boolean;
  children?: ReactNode;
}

/** Card header with the icon tile used across the data tools panels. */
export function PanelCardHeader({ icon: Icon, title, description, muted = false, children }: PanelCardHeaderProps) {
  return (
    <CardHeader>
      <div className="flex items-center gap-3">
        <div className={cn('shrink-0 rounded-xl p-3', muted ? 'bg-muted' : 'bg-primary/10')}>
          <Icon className={cn('size-6', muted ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {children}
      </div>
    </CardHeader>
  );
}
