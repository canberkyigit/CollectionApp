import type { LucideIcon } from 'lucide-react';
import { Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CategoryShowcaseCardProps {
  title: string;
  description: string;
  itemCount: number;
  libraryCount: number;
  totalValueLabel: string;
  averageValueLabel: string;
  lastUpdatedLabel: string;
  icon: LucideIcon;
  onClick: () => void;
}

export function CategoryShowcaseCard({
  title,
  description,
  itemCount,
  libraryCount,
  totalValueLabel,
  averageValueLabel,
  lastUpdatedLabel,
  icon: Icon,
  onClick,
}: CategoryShowcaseCardProps) {
  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden border-border/70 transition-all duration-300',
        'hover:-translate-y-1.5 hover:shadow-[0_26px_60px_rgb(0_0_0_/_0.12)] dark:hover:shadow-[0_28px_60px_rgb(0_0_0_/_0.28)]',
      )}
      onClick={onClick}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-primary/35 to-transparent opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_38%)] opacity-100 transition-opacity duration-300" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/70 to-transparent" />

      <CardHeader className="relative space-y-0 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-14 items-center justify-center rounded-[1.25rem] border border-primary/15 bg-primary/10 text-primary shadow-sm transition-all duration-300 group-hover:scale-[1.04] group-hover:bg-primary/12">
            <Icon className="size-7" />
          </div>
          <Badge variant="secondary" className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Badge>
        </div>

        <div className="mt-5 min-w-0 space-y-2">
          <h3 className="line-clamp-2 text-[1.05rem] font-semibold tracking-tight break-words">
            {title}
          </h3>
          <p className="min-h-[3.75rem] line-clamp-3 break-words text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </CardHeader>

      <CardContent className="relative flex-1 space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-2xl border border-border/65 bg-background/45 px-3 py-3 backdrop-blur-sm sm:px-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">
              Total Value
            </p>
            <p className="mt-2 truncate text-[0.96rem] font-semibold tracking-tight sm:text-base">
              {totalValueLabel}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border/65 bg-background/45 px-3 py-3 backdrop-blur-sm sm:px-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">
              Avg Item
            </p>
            <p className="mt-2 truncate text-[0.96rem] font-semibold tracking-tight sm:text-base">
              {averageValueLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/65 bg-background/35 px-3 py-3 text-sm backdrop-blur-sm sm:px-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">
              Libraries
            </p>
            <p className="mt-1 truncate font-medium">
              {libraryCount} {libraryCount === 1 ? 'space' : 'spaces'}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <div className="inline-flex max-w-full items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:gap-1.5 sm:text-[11px] sm:tracking-[0.18em]">
              <Clock3 className="size-3.5" />
              Updated
            </div>
            <p className="mt-1 truncate font-medium">{lastUpdatedLabel}</p>
          </div>
        </div>
      </CardContent>

    </Card>
  );
}
