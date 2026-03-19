import { useState, useMemo, useCallback } from 'react';
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Star,
  Tag,
  Calendar,
  DollarSign,
  Shield,
  BookOpen,
  Check,
  Filter,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

const CONDITIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'] as const;

export interface FilterState {
  conditions: string[];
  priceRange: [number, number];
  valueRange: [number, number];
  dateFrom: string;
  dateTo: string;
  tags: string[];
  favoritesOnly: boolean;
  hasImages: boolean | null;
  readStatus: 'all' | 'read' | 'unread';
  currencies: string[];
  customSelects: Record<string, string[]>;
  customBooleans: Record<string, boolean | null>;
}

export const DEFAULT_FILTERS: FilterState = {
  conditions: [],
  priceRange: [0, 0],
  valueRange: [0, 0],
  dateFrom: '',
  dateTo: '',
  tags: [],
  favoritesOnly: false,
  hasImages: null,
  readStatus: 'all',
  currencies: [],
  customSelects: {},
  customBooleans: {},
};

interface AdvancedFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  maxPrice: number;
  maxValue: number;
  availableTags: string[];
  availableCurrencies?: string[];
  currencySymbol?: string;
  category?: Category;
}

const EXCLUDED_FILTER_KEYS = new Set([
  'title', 'notes', 'condition', 'quantity',
  'purchaseCurrency', 'purchasePrice', 'purchaseDate', 'currentValue', 'isFirstEdition',
]);

export function AdvancedFilters({
  filters,
  onChange,
  maxPrice,
  maxValue,
  availableTags,
  availableCurrencies = [],
  currencySymbol = '$',
  category,
}: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  const isBookCategory = category?.id === 'cat-books';

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

  const toggleCondition = useCallback((cond: string) => {
    update({
      conditions: filters.conditions.includes(cond)
        ? filters.conditions.filter((c) => c !== cond)
        : [...filters.conditions, cond],
    });
  }, [filters.conditions, update]);

  const toggleTag = useCallback((tag: string) => {
    update({
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    });
  }, [filters.tags, update]);

  const toggleCurrency = useCallback((cur: string) => {
    update({
      currencies: filters.currencies.includes(cur)
        ? filters.currencies.filter((c) => c !== cur)
        : [...filters.currencies, cur],
    });
  }, [filters.currencies, update]);

  const toggleCustomSelect = useCallback((key: string, option: string) => {
    const current = filters.customSelects[key] ?? [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    update({ customSelects: { ...filters.customSelects, [key]: next } });
  }, [filters.customSelects, update]);

  const setCustomBoolean = useCallback((key: string, val: boolean | null) => {
    update({ customBooleans: { ...filters.customBooleans, [key]: val } });
  }, [filters.customBooleans, update]);

  const effectiveMaxPrice = Math.max(maxPrice, 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant={activeCount > 0 ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
              {activeCount}
            </Badge>
          )}
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </Button>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={resetFilters}>
            <RotateCcw className="size-3" />
            Clear all
          </Button>
        )}

        {/* Active filter chips */}
        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {filters.conditions.map((cond) => (
              <Badge key={cond} variant="secondary" className="gap-1 pr-1 text-xs">
                {cond}
                <button type="button" onClick={() => toggleCondition(cond)} className="rounded-full hover:bg-muted">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            {filters.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-xs">
                #{tag}
                <button type="button" onClick={() => toggleTag(tag)} className="rounded-full hover:bg-muted">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            {filters.favoritesOnly && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                <Star className="size-3 fill-yellow-500 text-yellow-500" />
                Favorites
                <button type="button" onClick={() => update({ favoritesOnly: false })} className="rounded-full hover:bg-muted">
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {filters.readStatus !== 'all' && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                <BookOpen className="size-3" />
                {filters.readStatus === 'read' ? 'Read' : 'Unread'}
                <button type="button" onClick={() => update({ readStatus: 'all' })} className="rounded-full hover:bg-muted">
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {filters.hasImages !== null && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                {filters.hasImages ? 'With images' : 'No images'}
                <button type="button" onClick={() => update({ hasImages: null })} className="rounded-full hover:bg-muted">
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {filters.currencies.map((cur) => (
              <Badge key={cur} variant="secondary" className="gap-1 pr-1 text-xs">
                <DollarSign className="size-3" />{cur}
                <button type="button" onClick={() => toggleCurrency(cur)} className="rounded-full hover:bg-muted">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            {Object.entries(filters.customSelects).map(([key, vals]) =>
              vals.map((v) => {
                const field = selectFields.find((f) => f.key === key);
                return (
                  <Badge key={`${key}-${v}`} variant="secondary" className="gap-1 pr-1 text-xs">
                    {field?.label}: {v}
                    <button type="button" onClick={() => toggleCustomSelect(key, v)} className="rounded-full hover:bg-muted">
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              }),
            )}
            {Object.entries(filters.customBooleans).map(([key, val]) => {
              if (val === null) return null;
              const field = booleanFields.find((f) => f.key === key);
              return (
                <Badge key={key} variant="secondary" className="gap-1 pr-1 text-xs">
                  {val ? <Check className="size-3 text-green-500" /> : <X className="size-3 text-red-400" />}
                  {field?.label}
                  <button type="button" onClick={() => setCustomBoolean(key, null)} className="rounded-full hover:bg-muted">
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded filter panel */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Condition */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Shield className="size-3.5" />
                Condition
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {CONDITIONS.map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleCondition(cond)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      filters.conditions.includes(cond)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            {/* Purchase Price Range */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <DollarSign className="size-3.5" />
                Purchase Price
              </Label>
              <Slider
                value={filters.priceRange}
                min={0}
                max={effectiveMaxPrice}
                step={Math.max(1, Math.floor(effectiveMaxPrice / 100))}
                onValueChange={(v) => update({ priceRange: [v[0], v[1]] })}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{currencySymbol}{filters.priceRange[0].toLocaleString()}</span>
                <span>{currencySymbol}{filters.priceRange[1].toLocaleString()}</span>
              </div>
            </div>

            {/* Purchase Currency */}
            {availableCurrencies.length > 1 && (
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <DollarSign className="size-3.5" />
                  Purchase Currency
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCurrencies.map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => toggleCurrency(cur)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        filters.currencies.includes(cur)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:bg-muted',
                      )}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Calendar className="size-3.5" />
                Date Added
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => update({ dateFrom: e.target.value })}
                  className="h-8 min-w-0 flex-1 text-xs"
                />
                <span className="shrink-0 text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => update({ dateTo: e.target.value })}
                  className="h-8 min-w-0 flex-1 text-xs"
                />
              </div>
            </div>

            {/* Tags */}
            {availableTags.length > 0 && (
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Tag className="size-3.5" />
                  Tags
                </Label>
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs transition-colors',
                        filters.tags.includes(tag)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:bg-muted',
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category-specific select fields (Language, Binding Type, etc.) */}
            {selectFields.map((field) => {
              const selected = filters.customSelects[field.key] ?? [];
              return (
                <div key={field.key} className="space-y-2.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Filter className="size-3.5" />
                    {field.label}
                  </Label>
                  <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                    {field.options!.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleCustomSelect(field.key, opt)}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          selected.includes(opt)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Quick toggles */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quick Filters
              </Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.favoritesOnly}
                    onCheckedChange={(c) => update({ favoritesOnly: !!c })}
                    className="shrink-0"
                  />
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="size-3.5 shrink-0 text-yellow-500" />
                    Favorites only
                  </span>
                </label>
                {isBookCategory && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.readStatus === 'read'}
                        onCheckedChange={(c) => update({ readStatus: c ? 'read' : 'all' })}
                        className="shrink-0"
                      />
                      <span className="flex items-center gap-1 text-sm">
                        <BookOpen className="size-3.5 shrink-0 text-green-500" />
                        Read only
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.readStatus === 'unread'}
                        onCheckedChange={(c) => update({ readStatus: c ? 'unread' : 'all' })}
                        className="shrink-0"
                      />
                      <span className="flex items-center gap-1 text-sm">
                        <BookOpen className="size-3.5 shrink-0 text-muted-foreground" />
                        Unread only
                      </span>
                    </label>
                  </>
                )}
                {/* Boolean custom fields (Signed, etc.) */}
                {booleanFields.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={filters.customBooleans[field.key] === true}
                      onCheckedChange={(c) => setCustomBoolean(field.key, c ? true : null)}
                      className="shrink-0"
                    />
                    <span className="text-sm">{field.label} only</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.hasImages === true}
                    onCheckedChange={(c) => update({ hasImages: c ? true : null })}
                    className="shrink-0"
                  />
                  <span className="text-sm">With images only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.hasImages === false}
                    onCheckedChange={(c) => update({ hasImages: c ? false : null })}
                    className="shrink-0"
                  />
                  <span className="text-sm">Without images</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
