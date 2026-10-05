import type { ReactNode } from 'react';

import { useT } from '@/i18n';
import { BRAND_NAME } from '@/lib/brand';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { getItemCurrentValue, getItemPurchaseValue } from '@/lib/valuation';
import type { Category, CategoryField, CollectionItem } from '@/types';

import {
  buildReportTotals,
  filledIdentifierFields,
  getKeyFields,
  getLastValuationDate,
} from './reportData';
import './reportPrint.css';

export interface InventoryReportProps {
  items: CollectionItem[];
  categories: Category[];
  displayCurrency: string;
  ownerName: string;
  scopeLabel: string;
  generatedAt: string;
}

function safeDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDate(value);
}

function Field({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'text-sm'}>{children}</dd>
    </div>
  );
}

/**
 * Printable A4 inventory / insurance report. Rendered with fixed paper colours
 * (white sheet, near-black ink) so it looks the same in light and dark mode and
 * when saved as PDF.
 */
export function InventoryReport({
  items,
  categories,
  displayCurrency,
  ownerName,
  scopeLabel,
  generatedAt,
}: InventoryReportProps) {
  const t = useT();
  const totals = buildReportTotals(items, categories, displayCurrency);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const gain = totals.currentTotal - totals.purchaseTotal;
  const money = (value: number) => formatCurrency(value, displayCurrency);

  const formatFieldValue = (field: CategoryField, value: unknown): string => {
    if (field.type === 'boolean') return value ? t('common.yes') : t('common.no');
    if (field.type === 'date' && typeof value === 'string') return safeDate(value);
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return formatNumber(value);
    return String(value);
  };

  const sortedItems = [...items].sort((left, right) => {
    const leftOrder = categoryById.get(left.categoryId)?.order ?? 999;
    const rightOrder = categoryById.get(right.categoryId)?.order ?? 999;
    return leftOrder - rightOrder || left.title.localeCompare(right.title);
  });

  return (
    <article className="curio-report bg-white text-neutral-900">
      {/* Cover */}
      <section className="curio-page-break flex min-h-96 flex-col justify-between gap-12 p-8 print:min-h-0 print:p-0">
        <header className="space-y-2 border-b border-neutral-300 pb-6">
          <p lang="en" className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">{BRAND_NAME}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('report.title')}</h1>
          <p className="text-sm text-neutral-600">{scopeLabel}</p>
        </header>

        <dl className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <Field label={t('report.owner')}>{ownerName || '—'}</Field>
          <Field label={t('report.date')}>{safeDate(generatedAt)}</Field>
          <Field label={t('report.currency')}>{displayCurrency}</Field>
          <Field label={t('report.itemCount')}>
            <span className="tabular-nums">{formatNumber(totals.count)}</span>
          </Field>
        </dl>

        <dl className="grid grid-cols-1 divide-y divide-neutral-300 border-y border-neutral-300 sm:grid-cols-3 sm:divide-x sm:divide-y-0 print:grid-cols-3 print:divide-x print:divide-y-0">
          <div className="py-4 sm:px-4 sm:first:pl-0">
            <dt className="text-xs text-neutral-500">{t('report.purchaseTotal')}</dt>
            <dd className="mt-1 text-2xl tabular-nums">{money(totals.purchaseTotal)}</dd>
          </div>
          <div className="py-4 sm:px-4">
            <dt className="text-xs text-neutral-500">{t('report.currentTotal')}</dt>
            <dd className="mt-1 text-2xl tabular-nums">{money(totals.currentTotal)}</dd>
          </div>
          <div className="py-4 sm:px-4">
            <dt className="text-xs text-neutral-500">{t('report.change')}</dt>
            <dd className="mt-1 text-2xl tabular-nums">{gain >= 0 ? '+' : ''}{money(gain)}</dd>
          </div>
        </dl>

        <p className="text-xs text-neutral-500">{t('report.disclaimer')}</p>
      </section>

      {/* Category summary */}
      <section className="curio-page-break space-y-4 p-8 print:p-0">
        <h2 className="text-xl font-semibold">{t('report.summaryTitle')}</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-400 text-left text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">{t('report.category')}</th>
              <th className="py-2 pr-3 text-right font-medium">{t('report.items')}</th>
              <th className="py-2 pr-3 text-right font-medium">{t('report.purchaseCost')}</th>
              <th className="py-2 text-right font-medium">{t('report.currentValue')}</th>
            </tr>
          </thead>
          <tbody>
            {totals.byCategory.map((row) => (
              <tr key={row.categoryId} className="border-b border-neutral-200">
                <td className="py-2 pr-3">{row.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(row.count)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(row.purchaseTotal)}</td>
                <td className="py-2 text-right tabular-nums">{money(row.currentTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-400 font-semibold">
              <td className="py-2 pr-3">{t('report.total')}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(totals.count)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{money(totals.purchaseTotal)}</td>
              <td className="py-2 text-right tabular-nums">{money(totals.currentTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Items */}
      <section className="space-y-4 p-8 print:p-0">
        <h2 className="text-xl font-semibold">{t('report.itemsTitle')}</h2>
        {sortedItems.length === 0 && <p className="text-sm text-neutral-500">{t('report.noItems')}</p>}
        <ol className="divide-y divide-neutral-300 border-y border-neutral-300">
          {sortedItems.map((item, index) => {
            const category = categoryById.get(item.categoryId);
            const fields = category?.fields ?? [];
            const keyFields = getKeyFields(item, fields);
            const identifiers = filledIdentifierFields(item, fields);
            const cover = item.images[0];
            const purchaseConverted = getItemPurchaseValue(item, displayCurrency);
            const currentConverted = getItemCurrentValue(item, displayCurrency);
            const currentCurrency = item.valuationInfo.currentValueCurrency || item.purchaseInfo.purchaseCurrency;
            const documents = item.documents ?? [];

            return (
              <li key={item.id} className="curio-avoid-break flex gap-4 py-4">
                <div className="curio-thumb w-24 shrink-0 overflow-hidden border border-neutral-200 bg-neutral-50">
                  {cover ? (
                    <img src={cover} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center p-1 text-center text-xs text-neutral-400">
                      {t('report.noPhoto')}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-base font-semibold">
                      <span className="mr-2 text-xs font-normal text-neutral-500 tabular-nums">{index + 1}.</span>
                      {item.title}
                    </h3>
                    <span className="text-xs text-neutral-500">{category?.name ?? '—'}</span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 print:grid-cols-4">
                    <Field label={t('report.condition')}>{item.condition || '—'}</Field>
                    <Field label={t('report.location')}>{item.location || '—'}</Field>
                    <Field label={t('report.purchaseDate')}>{safeDate(item.purchaseInfo.purchasedAt)}</Field>
                    <Field label={t('report.purchasePrice')}>
                      <span className="tabular-nums">
                        {formatCurrency(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency)}
                        {item.purchaseInfo.purchaseCurrency !== displayCurrency && (
                          <span className="block text-xs text-neutral-500">≈ {money(purchaseConverted)}</span>
                        )}
                      </span>
                    </Field>
                    <Field label={t('report.currentValue')}>
                      <span className="tabular-nums">
                        {formatCurrency(item.valuationInfo.currentEstimatedValue, currentCurrency)}
                        {currentCurrency !== displayCurrency && (
                          <span className="block text-xs text-neutral-500">≈ {money(currentConverted)}</span>
                        )}
                      </span>
                    </Field>
                    <Field label={t('report.lastValuation')}>{safeDate(getLastValuationDate(item))}</Field>
                    {(item.quantity ?? 1) > 1 && (
                      <Field label={t('report.quantity')}>
                        <span className="tabular-nums">{formatNumber(item.quantity ?? 1)}</span>
                      </Field>
                    )}
                    {identifiers.map((field) => (
                      <Field key={field.id} label={field.label} mono>
                        {formatFieldValue(field, item.customFields[field.key])}
                      </Field>
                    ))}
                  </dl>

                  {keyFields.length > 0 && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-neutral-200 pt-2 sm:grid-cols-3 print:grid-cols-3">
                      {keyFields.map((field) => (
                        <Field key={field.id} label={field.label}>
                          {formatFieldValue(field, item.customFields[field.key])}
                        </Field>
                      ))}
                    </dl>
                  )}

                  {documents.length > 0 && (
                    <div className="border-t border-neutral-200 pt-2">
                      <p className="text-xs text-neutral-500">{t('report.documents')}</p>
                      <ul className="mt-0.5 text-sm">
                        {documents.map((doc) => (
                          <li key={doc.id}>
                            {doc.title}
                            <span className="text-neutral-500"> · {t(`report.docType.${doc.type}`)} · {safeDate(doc.uploadedAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <footer className="pt-4 text-xs text-neutral-500">
          {t('report.footer', { brand: BRAND_NAME, date: safeDate(generatedAt) })}
        </footer>
      </section>
    </article>
  );
}
