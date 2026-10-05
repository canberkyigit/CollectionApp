import { QRCodeSVG } from 'qrcode.react';

import { useT } from '@/i18n';
import { BRAND_NAME } from '@/lib/brand';
import { getPublicItemUrl } from '@/lib/publicUrl';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { CategoryField, CollectionItem } from '@/types';

import './reportPrint.css';

export type SheetDetail = 'compact' | 'full';

function safeDate(value?: string): string {
  if (!value) return '—';
  return Number.isNaN(new Date(value).getTime()) ? value : formatDate(value);
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}…`;
}

function hasCustomFieldValue(field: CategoryField, value: unknown) {
  if (field.type === 'boolean') return value != null;
  if (Array.isArray(value)) return value.length > 0;
  return value != null && value !== '';
}

const HIDDEN_FIELD_KEYS = new Set(['title', 'notes', 'condition', 'quantity']);

/**
 * One item per page: photo, QR code, summary, description, details, notes and tags.
 * Uses fixed paper colours so the printout is identical in light and dark mode.
 */
export function ItemSheet({
  item,
  categoryName,
  categoryFields,
  detail,
}: {
  item: CollectionItem;
  categoryName?: string;
  categoryFields: CategoryField[];
  detail: SheetDetail;
}) {
  const t = useT();
  const compact = detail === 'compact';
  const coverImage = item.images[0];

  const formatFieldValue = (field: CategoryField, value: unknown) => {
    if (field.type === 'boolean') return value ? t('common.yes') : t('common.no');
    if (field.type === 'date' && typeof value === 'string') return safeDate(value);
    if (field.type === 'currency' && typeof value === 'number') return formatNumber(value);
    if (Array.isArray(value)) {
      const joined = value.join(', ');
      return compact ? truncateText(joined, 90) : joined;
    }
    const rendered = String(value);
    return compact ? truncateText(rendered, 120) : rendered;
  };

  const visibleCustomFields = categoryFields.filter((field) => (
    !HIDDEN_FIELD_KEYS.has(field.key)
    && field.type !== 'image'
    && hasCustomFieldValue(field, item.customFields[field.key])
  ));
  const customFieldsToShow = compact ? visibleCustomFields.slice(0, 6) : visibleCustomFields;
  const description = item.description || t('labels.noDescription');
  const notes = item.notes || t('labels.noNotes');
  const tagsToShow = compact ? item.tags.slice(0, 8) : item.tags;
  const hiddenTagCount = item.tags.length - tagsToShow.length;
  const hiddenFieldCount = visibleCustomFields.length - customFieldsToShow.length;

  const summary: { label: string; value: string }[] = [
    { label: t('labels.created'), value: safeDate(item.createdAt) },
    { label: t('labels.updated'), value: safeDate(item.updatedAt) },
    { label: t('labels.purchaseDate'), value: safeDate(item.purchaseInfo.purchasedAt) },
    {
      label: t('labels.purchasePrice'),
      value: formatCurrency(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency),
    },
    {
      label: t('labels.currentValue'),
      value: formatCurrency(
        item.valuationInfo.currentEstimatedValue,
        item.valuationInfo.currentValueCurrency || item.purchaseInfo.purchaseCurrency,
      ),
    },
  ];

  const sectionClass = 'rounded-2xl border border-slate-200 p-4';
  const sectionTitleClass = 'text-sm font-semibold uppercase tracking-[0.18em] text-slate-500';
  const chipClass = 'rounded-full border border-slate-300 px-3 py-1 font-medium';

  return (
    <article
      className={cn(
        'curio-report overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-950 shadow-none print:rounded-none print:border-0 print:shadow-none',
        compact && 'curio-avoid-break',
      )}
    >
      <div className="grid gap-6 p-6 print:grid-cols-[220px_minmax(0,1fr)] print:gap-8 print:p-0">
        <div className="curio-avoid-break space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {coverImage ? (
              <img src={coverImage} alt={item.title} className="h-[300px] w-full object-cover print:h-[320px]" />
            ) : (
              <div className="flex h-[300px] items-center justify-center px-6 text-center text-sm text-slate-500 print:h-[320px]">
                {t('labels.noImage')}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 text-center">
            <div className="mx-auto flex w-fit rounded-xl bg-white p-2">
              <QRCodeSVG value={getPublicItemUrl(item.id)} size={112} includeMargin={false} />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t('labels.qrCode')}</p>
            <p className="mt-1 text-xs text-slate-600">{t('labels.scanHint', { brand: BRAND_NAME })}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <header className="curio-avoid-break border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {categoryName ?? t('labels.collectionItem')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">{item.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={chipClass}>
                {t('labels.condition')}: {item.condition || '—'}
              </span>
              <span className={chipClass}>
                {t('labels.quantity')}: <span className="tabular-nums">{item.quantity ?? 1}</span>
              </span>
              {item.location && (
                <span className={chipClass}>
                  {t('labels.location')}: {item.location}
                </span>
              )}
            </div>
          </header>

          <div className="mt-5 grid gap-5 md:grid-cols-2 print:grid-cols-2">
            <section className={cn(sectionClass, 'curio-avoid-break')}>
              <h2 className={sectionTitleClass}>{t('labels.summary')}</h2>
              <dl className="mt-3 space-y-3 text-sm">
                {summary.map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{row.label}</dt>
                    <dd className="mt-1 font-medium tabular-nums">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={cn(sectionClass, compact && 'curio-avoid-break')}>
              <h2 className={sectionTitleClass}>{t('labels.description')}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {compact ? truncateText(description, 280) : description}
              </p>
            </section>
          </div>

          {customFieldsToShow.length > 0 && (
            <section className={cn(sectionClass, 'curio-avoid-break mt-5')}>
              <h2 className={sectionTitleClass}>{t('labels.details')}</h2>
              <dl className="mt-3 grid gap-3 md:grid-cols-2 print:grid-cols-2">
                {customFieldsToShow.map((field) => (
                  <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</dt>
                    <dd className="mt-1 text-sm font-medium leading-5 text-slate-900">
                      {formatFieldValue(field, item.customFields[field.key])}
                    </dd>
                  </div>
                ))}
              </dl>
              {compact && hiddenFieldCount > 0 && (
                <p className="mt-3 text-xs text-slate-500">{t('labels.moreFields', { count: hiddenFieldCount })}</p>
              )}
            </section>
          )}

          {(item.notes || item.tags.length > 0) && (
            <div className="mt-5 grid gap-5 md:grid-cols-2 print:grid-cols-2">
              <section className={cn(sectionClass, compact && 'curio-avoid-break')}>
                <h2 className={sectionTitleClass}>{t('labels.notes')}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {compact ? truncateText(notes, 320) : notes}
                </p>
              </section>
              <section className={cn(sectionClass, 'curio-avoid-break')}>
                <h2 className={sectionTitleClass}>{t('labels.tags')}</h2>
                {tagsToShow.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsToShow.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                        {tag}
                      </span>
                    ))}
                    {hiddenTagCount > 0 && (
                      <span className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500">
                        {t('labels.moreTags', { count: hiddenTagCount })}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">{t('labels.noTags')}</p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

const STICKERS_PER_PAGE = 24;

/** Compact 3×8 sticker sheets (A4): QR code, title, category and location. */
export function StickerSheets({
  items,
  categoryNameById,
}: {
  items: CollectionItem[];
  categoryNameById: Map<string, string>;
}) {
  const pages: CollectionItem[][] = [];
  for (let index = 0; index < items.length; index += STICKERS_PER_PAGE) {
    pages.push(items.slice(index, index + STICKERS_PER_PAGE));
  }

  return (
    <div className="space-y-4 print:space-y-0">
      {pages.map((page, pageIndex) => (
        <div key={pageIndex} className="curio-sticker-page">
          {page.map((item) => (
            <div
              key={item.id}
              className="curio-avoid-break flex items-center gap-2 overflow-hidden rounded-xl border border-slate-300 bg-white p-2 text-slate-950"
            >
              <QRCodeSVG value={getPublicItemUrl(item.id)} size={72} includeMargin={false} className="shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <p className="line-clamp-2 text-xs font-semibold leading-tight">{item.title}</p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {categoryNameById.get(item.categoryId) ?? ''}
                </p>
                {item.location && <p className="truncate text-[10px] text-slate-600">{item.location}</p>}
                <p className="truncate font-mono text-[10px] text-slate-400">{item.id}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
