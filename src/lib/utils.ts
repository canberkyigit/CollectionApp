import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { getLocale, t } from '@/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'USD'): string {
  const safeValue = Number(value) || 0;
  // Whole amounts without decimals ($1,200); otherwise always two ($8,780.80, not $8,780.8).
  const fractionDigits = Number.isInteger(Math.round(safeValue * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safeValue);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
}

/** Locale-aware percent from a percentage number (12.5 → "12.5%" / "%12,5"). */
export function formatPercent(value: number, { digits = 1, signed = false }: { digits?: number; signed?: boolean } = {}): string {
  const safeValue = Number(value) || 0;
  return new Intl.NumberFormat(getLocale(), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(safeValue / 100);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(getLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDate(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(now)) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('common.today');
  if (diffDays === -1) return t('common.yesterday');

  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });
  const abs = Math.abs(diffDays);
  if (abs < 7) return rtf.format(diffDays, 'day');
  if (abs < 30) return rtf.format(Math.trunc(diffDays / 7), 'week');
  if (abs < 365) return rtf.format(Math.trunc(diffDays / 30), 'month');
  return rtf.format(Math.trunc(diffDays / 365), 'year');
}

/** Local calendar date as YYYY-MM-DD (not UTC — avoids off-by-one after midnight in UTC+ zones). */
export function todayISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateGainLoss(purchasePrice: number, currentValue: number) {
  const safePurchase = Number(purchasePrice) || 0;
  const safeCurrent = Number(currentValue) || 0;
  const diff = safeCurrent - safePurchase;
  const percentage = safePurchase > 0 ? (diff / safePurchase) * 100 : 0;
  return { diff, percentage, isPositive: diff >= 0 };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u',
};

export function slugify(text: string): string {
  const slug = text
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (char) => TURKISH_CHAR_MAP[char] ?? char)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'collection';
}
