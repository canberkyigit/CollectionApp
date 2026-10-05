import { useState, useMemo, useCallback, useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Filter,
  Image as ImageIcon,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Star,
  Tag,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { conditionLabel } from '@/components/collections/conditionLabel';
import { useT } from '@/i18n';
import { isBookCategory as isBookCategoryCheck } from '@/lib/categoryKind';
import { cn, formatNumber } from '@/lib/utils';
import type { Category } from '@/types';
import { DEFAULT_FILTERS, type FilterState } from './advancedFilters.types';
import { getConditionScale } from '@/lib/conditionScales';


interface AdvancedFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  maxPrice: number;
  maxValue: number;
  availableTags: string[];
  availableCurrencies?: string[];
  currencySymbol?: string;
  category?: Category;
  /** Condition values present in the data; shown alongside the category's scale. */
  availableConditions?: string[];
  /** Extra controls rendered next to the Filters toggle (e.g. saved views). */
  toolbarSlot?: ReactNode;
}

const EXCLUDED_FILTER_KEYS = new Set([
  'title', 'notes', 'condition', 'quantity',
  'purchaseCurrency', 'purchasePrice', 'purchaseDate', 'currentValue', 'isFirstEdition',
]);

function ToggleChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2.5">
      <legend className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ActiveChip({
  children,
  icon,
  removeLabel,
  onRemove,
}: {
  children: ReactNode;
  icon?: ReactNode;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 text-xs">
      {icon}
      <span>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}

export function AdvancedFilters({
  filters,
  onChange,
  maxPrice,
  maxValue,
  availableTags,
  availableCurrencies = [],
  currencySymbol = '$',
  category,
  availableConditions,
  toolbarSlot,
}: AdvancedFiltersProps) {
  const t = useT();
  const conditionOptions = useMemo(() => {
    const scale = getConditionScale(category).map((grade) => grade.value);
    const extras = (availableConditions ?? []).filter((value) => !scale.includes(value));
    return [...scale, ...extras];
  }, [category, availableConditions]);
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const isBookCategory = isBookCategoryCheck(category);

  const selectFields = useMemo(
    () =>
      (category?.fields ?? []).filter(
        (f) => f.type === 'select' && f.options && f.options.length > 0 && !EXCLUDED_FILTER_KEYS.has(f.key),
      ),
    [category],
  );

  const booleanFields = useMemo(
    () => (category?.fields ?? []).filter((f) => f.type === 'boolean' && !EXCLUDED_FILTER_KEYS.has(f.key)),
    [category],
  );

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.conditions.length > 0) count++;
    if (filters.priceRange[0] > 0 || (filters.priceRange[1] > 0 && filters.priceRange[1] < maxPrice)) count++;
    if (filters.valueRange[0] > 0 || (filters.valueRange[1] > 0 && filters.valueRange[1] < maxValue)) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.tags.length > 0) count++;
    if (filters.favoritesOnly) count++;
    if (filters.hasImages !== null) count++;
    if (filters.readStatus !== 'all') count++;
    if (filters.currencies.length > 0) count++;
    for (const vals of Object.values(filters.customSelects)) {
      if (vals.length > 0) count++;
    }
    for (const val of Object.values(filters.customBooleans)) {
      if (val !== null) count++;
    }
    return count;
  }, [filters, maxPrice, maxValue]);

  const update = useCallback(
    (patch: Partial<FilterState>) => onChange({ ...filters, ...patch }),
    [filters, onChange],
  );

  const resetFilters = useCallback(
    () => onChange({ ...DEFAULT_FILTERS, priceRange: [0, maxPrice], valueRange: [0, maxValue] }),
    [onChange, maxPrice, maxValue],
  );

  const toggleIn = (list: string[], value: string) => (
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
  );

  const toggleCustomSelect = useCallback((key: string, option: string) => {
    const current = filters.customSelects[key] ?? [];
    update({ customSelects: { ...filters.customSelects, [key]: toggleIn(current, option) } });
  }, [filters.customSelects, update]);

  const setCustomBoolean = useCallback((key: string, val: boolean | null) => {
    update({ customBooleans: { ...filters.customBooleans, [key]: val } });
  }, [filters.customBooleans, update]);

  const effectiveMaxPrice = Math.max(maxPrice, 1);
  const effectiveMaxValue = Math.max(maxValue, 1);
  const money = (value: number) => `${currencySymbol}${formatNumber(value)}`;
  const removeLabel = (label: string) => t('collections.filters.remove', { label });
  const priceActive = filters.priceRange[0] > 0 || (filters.priceRange[1] > 0 && filters.priceRange[1] < maxPrice);
  const valueActive = filters.valueRange[0] > 0 || (filters.valueRange[1] > 0 && filters.valueRange[1] < maxValue);

  const checkboxRow = (
    id: string,
    checked: boolean,
    onCheckedChange: (checked: boolean) => void,
    label: string,
    icon?: ReactNode,
  ) => (
    <div className="flex items-center gap-2">
      <Checkbox id={id} className="shrink-0" checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <label htmlFor={id} className="flex cursor-pointer items-center gap-1 text-sm">
        {icon}
        {label}
      </label>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={activeCount > 0 ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal className="size-3.5" />
          {t('collections.filters.toggle')}{' '}
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-[10px]">
              {formatNumber(activeCount)}
            </Badge>
          )}
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </Button>

        {toolbarSlot}

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={resetFilters}>
            <RotateCcw className="size-3" />
            {t('collections.filters.clearAll')}
          </Button>
        )}

        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {filters.conditions.map((cond) => (
              <ActiveChip key={cond} removeLabel={removeLabel(conditionLabel(t, cond))} onRemove={() => update({ conditions: toggleIn(filters.conditions, cond) })}>
                {conditionLabel(t, cond)}
              </ActiveChip>
            ))}
            {filters.tags.map((tag) => (
              <ActiveChip key={tag} removeLabel={removeLabel(`#${tag}`)} onRemove={() => update({ tags: toggleIn(filters.tags, tag) })}>
                #{tag}
              </ActiveChip>
            ))}
            {priceActive && (
              <ActiveChip
                icon={<DollarSign className="size-3" aria-hidden="true" />}
                removeLabel={removeLabel(t('collections.filters.purchasePrice'))}
                onRemove={() => update({ priceRange: [0, maxPrice] })}
              >
                {t('collections.filters.purchasePrice')}: {money(filters.priceRange[0])}–{money(filters.priceRange[1])}
              </ActiveChip>
            )}
            {valueActive && (
              <ActiveChip
                icon={<TrendingUp className="size-3" aria-hidden="true" />}
                removeLabel={removeLabel(t('collections.filters.currentValue'))}
                onRemove={() => update({ valueRange: [0, maxValue] })}
              >
                {t('collections.filters.currentValue')}: {money(filters.valueRange[0])}–{money(filters.valueRange[1])}
              </ActiveChip>
            )}
            {(filters.dateFrom || filters.dateTo) && (
              <ActiveChip
                icon={<Calendar className="size-3" aria-hidden="true" />}
                removeLabel={removeLabel(t('collections.filters.dateAdded'))}
                onRemove={() => update({ dateFrom: '', dateTo: '' })}
              >
                <span className="tabular-nums">{filters.dateFrom || '…'} – {filters.dateTo || '…'}</span>
              </ActiveChip>
            )}
            {filters.favoritesOnly && (
              <ActiveChip
                icon={<Star className="size-3 fill-yellow-500 text-yellow-500" aria-hidden="true" />}
                removeLabel={removeLabel(t('collections.filters.favorites'))}
                onRemove={() => update({ favoritesOnly: false })}
              >
                {t('collections.filters.favorites')}
              </ActiveChip>
            )}
            {filters.readStatus !== 'all' && (
              <ActiveChip
                icon={<BookOpen className="size-3" aria-hidden="true" />}
                removeLabel={removeLabel(t(`collections.filters.${filters.readStatus}`))}
                onRemove={() => update({ readStatus: 'all' })}
              >
                {t(`collections.filters.${filters.readStatus}`)}
              </ActiveChip>
            )}
            {filters.hasImages !== null && (
              <ActiveChip
                icon={<ImageIcon className="size-3" aria-hidden="true" />}
                removeLabel={removeLabel(filters.hasImages ? t('collections.filters.withImages') : t('collections.filters.noImages'))}
                onRemove={() => update({ hasImages: null })}
              >
                {filters.hasImages ? t('collections.filters.withImages') : t('collections.filters.noImages')}
              </ActiveChip>
            )}
            {filters.currencies.map((cur) => (
              <ActiveChip
                key={cur}
                icon={<DollarSign className="size-3" aria-hidden="true" />}
                removeLabel={removeLabel(cur)}
                onRemove={() => update({ currencies: toggleIn(filters.currencies, cur) })}
              >
                {cur}
              </ActiveChip>
            ))}
            {Object.entries(filters.customSelects).map(([key, vals]) =>
              vals.map((v) => {
                const field = selectFields.find((f) => f.key === key);
                const label = `${field?.label ?? key}: ${v}`;
                return (
                  <ActiveChip key={`${key}-${v}`} removeLabel={removeLabel(label)} onRemove={() => toggleCustomSelect(key, v)}>
                    {label}
                  </ActiveChip>
                );
              }),
            )}
            {Object.entries(filters.customBooleans).map(([key, val]) => {
              if (val === null) return null;
              const field = booleanFields.find((f) => f.key === key);
              const label = val
                ? field?.label ?? key
                : t('collections.filters.notField', { label: field?.label ?? key });
              return (
                <ActiveChip
                  key={key}
                  icon={val
                    ? <Check className="size-3 text-green-500" aria-hidden="true" />
                    : <X className="size-3 text-red-400" aria-hidden="true" />}
                  removeLabel={removeLabel(label)}
                  onRemove={() => setCustomBoolean(key, null)}
                >
                  {label}
                </ActiveChip>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="advanced-filters-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
        <div id={panelId} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <FilterGroup label={t('collections.filters.condition')} icon={Shield}>
              <div className="flex flex-wrap gap-1.5">
                {conditionOptions.map((cond) => (
                  <ToggleChip
                    key={cond}
                    pressed={filters.conditions.includes(cond)}
                    onClick={() => update({ conditions: toggleIn(filters.conditions, cond) })}
                  >
                    {conditionLabel(t, cond)}
                  </ToggleChip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup label={t('collections.filters.purchasePrice')} icon={DollarSign}>
              <Slider
                value={filters.priceRange}
                min={0}
                max={effectiveMaxPrice}
                step={Math.max(1, Math.floor(effectiveMaxPrice / 100))}
                onValueChange={(v) => update({ priceRange: [v[0], v[1]] })}
                aria-label={t('collections.filters.purchasePrice')}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{money(filters.priceRange[0])}</span>
                <span>{money(filters.priceRange[1])}</span>
              </div>
            </FilterGroup>

            <FilterGroup label={t('collections.filters.currentValue')} icon={TrendingUp}>
              <Slider
                value={filters.valueRange}
                min={0}
                max={effectiveMaxValue}
                step={Math.max(1, Math.floor(effectiveMaxValue / 100))}
                onValueChange={(v) => update({ valueRange: [v[0], v[1]] })}
                aria-label={t('collections.filters.currentValue')}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{money(filters.valueRange[0])}</span>
                <span>{money(filters.valueRange[1])}</span>
              </div>
            </FilterGroup>

            {availableCurrencies.length > 1 && (
              <FilterGroup label={t('collections.filters.purchaseCurrency')} icon={DollarSign}>
                <div className="flex flex-wrap gap-1.5">
                  {availableCurrencies.map((cur) => (
                    <ToggleChip
                      key={cur}
                      pressed={filters.currencies.includes(cur)}
                      onClick={() => update({ currencies: toggleIn(filters.currencies, cur) })}
                    >
                      {cur}
                    </ToggleChip>
                  ))}
                </div>
              </FilterGroup>
            )}

            <FilterGroup label={t('collections.filters.dateAdded')} icon={Calendar}>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => update({ dateFrom: e.target.value })}
                  aria-label={t('collections.filters.dateFrom')}
                  className="h-8 min-w-0 flex-1 text-xs tabular-nums"
                />
                <span className="shrink-0 text-xs text-muted-foreground">{t('collections.filters.to')}</span>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => update({ dateTo: e.target.value })}
                  aria-label={t('collections.filters.dateTo')}
                  className="h-8 min-w-0 flex-1 text-xs tabular-nums"
                />
              </div>
            </FilterGroup>

            {availableTags.length > 0 && (
              <FilterGroup label={t('collections.filters.tags')} icon={Tag}>
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <ToggleChip
                      key={tag}
                      pressed={filters.tags.includes(tag)}
                      onClick={() => update({ tags: toggleIn(filters.tags, tag) })}
                    >
                      #{tag}
                    </ToggleChip>
                  ))}
                </div>
              </FilterGroup>
            )}

            {selectFields.map((field) => {
              const selected = filters.customSelects[field.key] ?? [];
              return (
                <FilterGroup key={field.key} label={field.label} icon={Filter}>
                  <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                    {field.options!.map((opt) => (
                      <ToggleChip
                        key={opt}
                        pressed={selected.includes(opt)}
                        onClick={() => toggleCustomSelect(field.key, opt)}
                      >
                        {opt}
                      </ToggleChip>
                    ))}
                  </div>
                </FilterGroup>
              );
            })}

            <FilterGroup label={t('collections.filters.quick')}>
              <div className="space-y-2">
                {checkboxRow(
                  `${panelId}-favorites`,
                  filters.favoritesOnly,
                  (checked) => update({ favoritesOnly: checked }),
                  t('collections.filters.favoritesOnly'),
                  <Star className="size-3.5 shrink-0 text-yellow-500" aria-hidden="true" />,
                )}
                {isBookCategory && (
                  <>
                    {checkboxRow(
                      `${panelId}-read`,
                      filters.readStatus === 'read',
                      (checked) => update({ readStatus: checked ? 'read' : 'all' }),
                      t('collections.filters.readOnly'),
                      <BookOpen className="size-3.5 shrink-0 text-green-500" aria-hidden="true" />,
                    )}
                    {checkboxRow(
                      `${panelId}-unread`,
                      filters.readStatus === 'unread',
                      (checked) => update({ readStatus: checked ? 'unread' : 'all' }),
                      t('collections.filters.unreadOnly'),
                      <BookOpen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />,
                    )}
                  </>
                )}
                {booleanFields.map((field) => (
                  <div key={field.key}>
                    {checkboxRow(
                      `${panelId}-bool-${field.key}`,
                      filters.customBooleans[field.key] === true,
                      (checked) => setCustomBoolean(field.key, checked ? true : null),
                      t('collections.filters.fieldOnly', { label: field.label }),
                    )}
                  </div>
                ))}
                {checkboxRow(
                  `${panelId}-with-images`,
                  filters.hasImages === true,
                  (checked) => update({ hasImages: checked ? true : null }),
                  t('collections.filters.withImagesOnly'),
                )}
                {checkboxRow(
                  `${panelId}-without-images`,
                  filters.hasImages === false,
                  (checked) => update({ hasImages: checked ? false : null }),
                  t('collections.filters.withoutImages'),
                )}
              </div>
            </FilterGroup>
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
