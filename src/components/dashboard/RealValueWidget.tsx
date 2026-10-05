import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';

import type { CollectionItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRealValueSummary, type RealValueReference } from '@/lib/realValue';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { getLocale, useT } from '@/i18n';
import { useCollectionStore } from '@/store/useCollectionStore';

const REFERENCES: RealValueReference[] = ['USD', 'EUR'];

function formatSignedPercent(value: number | null): string {
  if (value === null) return '–';
  return new Intl.NumberFormat(getLocale(), {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function toneFor(value: number | null) {
  if (value === null || Math.abs(value) < 0.05) return 'text-foreground';
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
}

const PANEL_CLASS =
  'h-full overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.84))] shadow-[0_16px_40px_rgb(15_23_42_/_0.06)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.88))] dark:shadow-[0_18px_40px_rgb(0_0_0_/_0.22)]';

function MetricTile({ label, value, valueClassName, note }: { label: string; value: string; valueClassName?: string; note: string }) {
  return (
    <div className="rounded-[1.25rem] border border-border/60 bg-background/55 px-4 py-3.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums', valueClassName)}>{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground tabular-nums">{note}</dd>
    </div>
  );
}

/**
 * Real value: cost basis vs today, in lira and in USD/EUR terms, using the FX
 * rates stored on each item at purchase time.
 */
export function RealValueWidget({ items }: { items: CollectionItem[] }) {
  const t = useT();
  const displayCurrency = useCollectionStore((state) => state.displayCurrency);
  const [reference, setReference] = useState<RealValueReference>(displayCurrency === 'EUR' ? 'EUR' : 'USD');
  const summary = useMemo(() => getRealValueSummary(items, reference), [items, reference]);
  const movers = useMemo(
    () => [...summary.items]
      .sort((left, right) => Math.abs(right.realChangePct ?? 0) - Math.abs(left.realChangePct ?? 0))
      .slice(0, 5),
    [summary.items],
  );
  const ref = (value: number) => formatCurrency(value, reference);
  const lira = (value: number) => formatCurrency(value, 'TRY');
  const titleId = useId();

  return (
    <Card role="region" aria-labelledby={titleId} className={PANEL_CLASS}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/55 pb-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary" aria-hidden="true">
              <Scale className="size-4.5" />
            </span>
            <span id={titleId}>{t('dashboard.widget.real-value')}</span>
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-6">
            {t('dashboard.realValue.description', { currency: reference })}
          </CardDescription>
        </div>
        <div
          role="group"
          aria-label={t('dashboard.realValue.referenceLabel')}
          className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/65 p-1"
        >
          {REFERENCES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={reference === option}
              onClick={() => setReference(option)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold tabular-nums transition-all',
                reference === option
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {summary.items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-center">
            <p className="text-sm font-medium">{t('dashboard.realValue.emptyTitle')}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('dashboard.realValue.emptyDescription')}</p>
          </div>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label={t('dashboard.realValue.paid')}
                value={lira(summary.paidTRY)}
                note={t('dashboard.realValue.approxThen', { amount: ref(summary.paidRef) })}
              />
              <MetricTile
                label={t('dashboard.realValue.worth')}
                value={lira(summary.worthTRY)}
                note={t('dashboard.realValue.approxNow', { amount: ref(summary.worthRef) })}
              />
              <MetricTile
                label={t('dashboard.realValue.realChange', { currency: reference })}
                value={formatSignedPercent(summary.realChangePct)}
                valueClassName={toneFor(summary.realChangePct)}
                note={t('dashboard.realValue.nominalChange', { value: formatSignedPercent(summary.nominalChangePct) })}
              />
            </dl>

            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('dashboard.realValue.moversCaption', { currency: reference })}</caption>
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('dashboard.realValue.col.item')}</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('dashboard.realValue.col.paid', { currency: reference })}</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('dashboard.realValue.col.worth', { currency: reference })}</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('dashboard.realValue.col.change')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movers.map((entry) => (
                    <tr key={entry.item.id} className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/50">
                      <td className="max-w-48 truncate px-3 py-2.5 font-medium">
                        <Link to={`/items/${entry.item.id}`} className="hover:text-primary hover:underline">{entry.item.title}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{ref(entry.paidRef)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{ref(entry.worthRef)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', toneFor(entry.realChangePct))}>
                        {formatSignedPercent(entry.realChangePct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          {t('dashboard.realValue.basis', { count: summary.items.length, n: formatNumber(summary.items.length) })}
          {summary.missingRateCount > 0 && (
            <> {t('dashboard.realValue.missing', { count: summary.missingRateCount, n: formatNumber(summary.missingRateCount) })}</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
