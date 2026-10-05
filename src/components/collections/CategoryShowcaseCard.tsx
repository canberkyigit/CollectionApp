import type { LucideIcon } from 'lucide-react';
import { Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { RelativeTime } from '@/components/shared/RelativeTime';

interface CategoryShowcaseCardProps {
  title: string;
  description: string;
  /** Up to four cover images (most valuable / most recent first). */
  thumbnails: string[];
  /** e.g. "12 items" */
  itemCountLabel: string;
  /** Bottom-left stat: libraries when the collection uses them, otherwise its most valuable piece. */
  secondaryStat: { label: string; value: string; title?: string };
  totalValueLabel: string;
  /** Exact amount shown on hover when the label is abbreviated. */
  totalValueTitle?: string;
  averageValueLabel: string;
  averageValueTitle?: string;
  /** ISO timestamp of the latest change. */
  lastUpdated: string;
  icon: LucideIcon;
  to: string;
  className?: string;
}

/** Long amounts (e.g. "$1,366.50") step down a size in narrow stat tiles instead of being cut off. */
const LONG_VALUE = '@max-[5rem]:text-sm';

function CoverMosaic({ thumbnails }: { thumbnails: string[] }) {
  const covers = thumbnails.slice(0, 4);
  const layout = covers.length === 1
    ? 'grid-cols-1'
    : covers.length === 2
      ? 'grid-cols-2'
      : 'grid-cols-2 grid-rows-2';

  return (
    <div className={cn('grid size-full gap-0.5', layout)}>
      {covers.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className={cn('min-h-0 overflow-hidden bg-muted', covers.length === 3 && index === 0 && 'row-span-2')}
        >
          <img
            src={src}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </div>
      ))}
    </div>
  );
}

export function CategoryShowcaseCard({
  title,
  description,
  thumbnails,
  itemCountLabel,
  secondaryStat,
  totalValueLabel,
  totalValueTitle,
  averageValueLabel,
  averageValueTitle,
  lastUpdated,
  icon: Icon,
  to,
  className,
}: CategoryShowcaseCardProps) {
  const t = useT();
  const hasCovers = thumbnails.length > 0;

  const iconTile = (
    <div
      className={cn(
        'flex size-14 items-center justify-center rounded-[1.25rem] border border-primary/15 bg-primary/10 text-primary shadow-sm transition-all duration-300 group-hover:scale-[1.04] group-hover:bg-primary/12',
        hasCovers && 'border-white/40 bg-background/80 backdrop-blur-md',
      )}
    >
      <Icon className="size-7" aria-hidden="true" />
    </div>
  );

  const countBadge = (
    <Badge
      variant="secondary"
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm',
        hasCovers && 'border-white/30 bg-background/75 backdrop-blur-md',
      )}
    >
      {itemCountLabel}
    </Badge>
  );

  return (
    <Link
      to={to}
      className={cn(
        'surface-2 group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 text-card-foreground transition-all duration-300',
        'hover:-translate-y-1.5 hover:shadow-[0_26px_60px_rgb(0_0_0_/_0.12)] dark:hover:shadow-[0_28px_60px_rgb(0_0_0_/_0.28)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-primary/70 via-primary/35 to-transparent opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_38%)] opacity-100 transition-opacity duration-300" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/70 to-transparent" />

      {hasCovers ? (
        <div className="relative h-36 overflow-hidden">
          <CoverMosaic thumbnails={thumbnails} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_45%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-6 pb-1">
            {iconTile}
            {countBadge}
          </div>
        </div>
      ) : null}

      <div className={cn('relative flex flex-col p-6 pb-4', hasCovers && 'pt-4')}>
        {!hasCovers && (
          <div className="mb-5 flex items-start justify-between gap-3">
            {iconTile}
            {countBadge}
          </div>
        )}

        <div className="min-w-0 space-y-2">
          <h3 className="line-clamp-2 text-[1.05rem] font-semibold tracking-tight break-words">
            {title}
          </h3>
          <p className="min-h-[3.75rem] line-clamp-3 break-words text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="relative flex-1 space-y-4 px-6 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="@container min-w-0 rounded-2xl border border-border/65 bg-background/45 px-3 py-3 backdrop-blur-sm sm:px-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:tracking-[0.18em]">
              {t('collections.card.totalValue')}
            </p>
            <p className={cn('mt-2 truncate text-[0.96rem] font-semibold tabular-nums tracking-tight sm:text-base', totalValueLabel.length > 8 && LONG_VALUE)} title={totalValueTitle}>
              {totalValueLabel}
            </p>
          </div>
          <div className="@container min-w-0 rounded-2xl border border-border/65 bg-background/45 px-3 py-3 backdrop-blur-sm sm:px-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:tracking-[0.18em]">
              {t('collections.card.averageValue')}
            </p>
            <p className={cn('mt-2 truncate text-[0.96rem] font-semibold tabular-nums tracking-tight sm:text-base', averageValueLabel.length > 8 && LONG_VALUE)} title={averageValueTitle}>
              {averageValueLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/65 bg-background/35 px-3 py-3 text-sm backdrop-blur-sm sm:px-3.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:tracking-[0.18em]">
              {secondaryStat.label}
            </p>
            <p className="mt-1 truncate font-medium" title={secondaryStat.title}>{secondaryStat.value}</p>
          </div>
          <div className="min-w-0 text-right">
            <div className="inline-flex max-w-full items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:gap-1.5 sm:tracking-[0.18em]">
              <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t('collections.card.updated')}</span>
            </div>
            <RelativeTime date={lastUpdated} className="mt-1 block truncate font-medium" />
          </div>
        </div>
      </div>
    </Link>
  );
}
